// Construção do histórico de patrimônio (últimos N dias) a partir do
// saldo ATUAL e do extrato. Como a Pluggy só expõe saldo "agora", precisamos
// reverter o extrato dia-a-dia para estimar o saldo passado.
//
// Esta função foi extraída do FinanceContext para ser TESTÁVEL e UNIVERSAL:
// vale para qualquer banco/conector novo que entre na plataforma. Não há
// regras hardcoded por nome de banco.
//
// Regras de normalização (anti "patrimônio negativo"):
//   1. Apenas contas BANK/INVESTMENT entram (CREDIT vira fatura, não patrimônio).
//   2. Contas com saldo atual ZERO + transações recentes (até 30d) são tratadas
//      como "fonte incompleta" (caso clássico Mercado Pago/OAuth proprietário).
//      Para essas contas só consideramos o ponto "hoje" — não rebobinamos.
//   3. A série começa em max(hoje - DAYS, primeira_transacao_confiavel + 1d).
//      Antes da primeira transação não temos sinal pra estimar o passado, então
//      não inventamos pontos negativos.
//   4. Se a rebobinação ainda assim produzir valor negativo (indica que a
//      Pluggy retornou mais entradas do que cabem no saldo atual + saídas —
//      sinal de que o extrato vai mais longe que o saldo conhecido), fazemos
//      "clamp em zero" no ponto, pois saldo de conta corrente real nunca é
//      negativo (cheque especial é registrado como `bank_overdraft_used`).
//   5. Marcamos `hasIncompleteHistory=true` para a UI poder explicar.

export interface PatrimonyAccountInput {
  pluggyAccountId: string;
  type: string | null; // "BANK" | "CREDIT" | "INVESTMENT" | ...
  balance: number | null;
  automaticallyInvestedBalance: number | null;
}

export interface PatrimonyTransactionInput {
  pluggyAccountId: string | null;
  /** ISO date. */
  date: string;
  /** "entrada" → soma; "saida" → subtrai (sempre positivo em |value|). */
  type: "entrada" | "saida" | string;
  value: number;
}

export interface PatrimonyPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface PatrimonyHistoryResult {
  points: PatrimonyPoint[];
  /** Pelo menos uma conta foi excluída ou clampada. */
  hasIncompleteHistory: boolean;
  /** IDs de contas (Pluggy) cujo saldo zero+movimento foi detectado. */
  excludedZeroBalanceAccounts: string[];
}

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface BuildPatrimonyHistoryOptions {
  /** Quantos dias da série, padrão 90. */
  days?: number;
  /** Data de referência (hoje). Default: new Date(). */
  referenceDate?: Date;
}

export function buildPatrimonyHistory(
  accounts: PatrimonyAccountInput[],
  transactions: PatrimonyTransactionInput[],
  opts: BuildPatrimonyHistoryOptions = {},
): PatrimonyHistoryResult {
  const days = opts.days ?? 90;
  const ref = opts.referenceDate ?? new Date();

  const isBank = (a: PatrimonyAccountInput) =>
    (a.type ?? "").toUpperCase() !== "CREDIT";

  const bankAccounts = accounts.filter(isBank);
  if (bankAccounts.length === 0) {
    return { points: [], hasIncompleteHistory: false, excludedZeroBalanceAccounts: [] };
  }

  // 1) Detecta contas com "fonte incompleta" (saldo zero + movimento recente).
  const cutoff = ref.getTime() - RECENT_WINDOW_MS;
  const movedRecentlyByAcc = new Set<string>();
  for (const t of transactions) {
    if (!t.pluggyAccountId) continue;
    const ts = new Date(t.date).getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts >= cutoff) movedRecentlyByAcc.add(t.pluggyAccountId);
  }
  const excludedZeroBalance: string[] = [];
  const reliableBankIds = new Set<string>();
  for (const a of bankAccounts) {
    const bal = a.balance ?? 0;
    const inv = a.automaticallyInvestedBalance ?? 0;
    if (bal === 0 && inv === 0 && movedRecentlyByAcc.has(a.pluggyAccountId)) {
      excludedZeroBalance.push(a.pluggyAccountId);
      continue;
    }
    reliableBankIds.add(a.pluggyAccountId);
  }

  // Patrimônio "agora" considerando apenas contas confiáveis (excluímos zero-suspeito
  // pra não introduzir um ponto que já nasce errado).
  const current = bankAccounts.reduce((sum, a) => {
    if (!reliableBankIds.has(a.pluggyAccountId)) return sum;
    return sum + (a.balance ?? 0);
  }, 0);

  // 2) Agrega deltas diários SOMENTE de contas confiáveis.
  const byDay = new Map<string, number>();
  let earliestReliableMs = Infinity;
  for (const t of transactions) {
    const accId = t.pluggyAccountId ?? "";
    if (!reliableBankIds.has(accId)) continue;
    const d = new Date(t.date);
    const ms = d.getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms < earliestReliableMs) earliestReliableMs = ms;
    const delta = t.type === "entrada" ? t.value : -Math.abs(t.value);
    const key = dayKey(d);
    byDay.set(key, (byDay.get(key) ?? 0) + delta);
  }

  // 3) Determina o começo da série: não vai além da primeira transação confiável.
  const today = new Date(ref);
  today.setHours(0, 0, 0, 0);

  let maxDays = days;
  if (Number.isFinite(earliestReliableMs)) {
    const earliest = new Date(earliestReliableMs);
    earliest.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - earliest.getTime()) / (24 * 60 * 60 * 1000));
    // +1 porque queremos incluir o dia da primeira transação como base "antes dela"
    maxDays = Math.min(days, Math.max(1, diffDays + 1));
  } else {
    // Sem transações em contas confiáveis → só faz sentido o ponto "hoje".
    maxDays = 1;
  }

  // 4) Rebobina dia-a-dia. Floor a 0 para evitar negativos espúrios.
  const points: PatrimonyPoint[] = [];
  let value = current;
  let clampedNegative = false;
  for (let i = 0; i < maxDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const safeValue = value < 0 ? (clampedNegative = true, 0) : Math.round(value * 100) / 100;
    points.push({ date: dayKey(d), value: safeValue });
    const delta = byDay.get(dayKey(d)) ?? 0;
    // Reverter: para ir um dia atrás, subtraímos o delta do dia atual.
    value -= delta;
  }

  return {
    points: points.reverse(),
    hasIncompleteHistory: clampedNegative || excludedZeroBalance.length > 0,
    excludedZeroBalanceAccounts: excludedZeroBalance,
  };
}
