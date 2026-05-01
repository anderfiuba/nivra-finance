/**
 * Detecção de transferências internas e pagamentos de fatura.
 *
 * Motivação (extraído do RELATORIO_REGRA_NEGOCIO.md):
 *   `computeTotals` historicamente somava TUDO como entrada/saída bruta. Isso
 *   produzia "double counting" no Dashboard e no Extrato:
 *
 *     - Transferência da conta A → conta B do mesmo usuário aparecia como
 *       saída em A E entrada em B → inflava entradas e saídas, sem refletir
 *       fluxo real de dinheiro novo.
 *     - Pagamento de fatura aparecia como saída na conta corrente E como
 *       "entrada" (CREDIT) na conta de cartão → mesma distorção.
 *
 * Este módulo é PURO (sem dependências de React/Supabase) para ser testável e
 * universal: vale para qualquer conector novo, sem regra hardcoded por banco.
 *
 * Estratégia:
 *   1. `isCardPayment(t)` — heurística por categoria Pluggy ("Credit card
 *      payment") + descrição ("pagamento de fatura", "payment received").
 *   2. `isInternalTransferByCategory(t)` — categoria contém "transfer".
 *   3. `findInternalTransferIds(txs)` — pareia DÉBITO em conta A com CRÉDITO
 *      equivalente em conta B (mesmo dia ±1, valor exato com tolerância de
 *      R$ 0,01) — robustez para casos onde a categoria não é "Transferência".
 *
 *   `excludeNonCashFlowIds` retorna o Set de IDs a IGNORAR em totais brutos.
 */

export interface TransferTxLike {
  id: string;
  /** ISO date. */
  date: string;
  description: string;
  category: string;
  /** Sempre positivo no nosso modelo. */
  value: number;
  type: "entrada" | "saida";
  pluggyAccountId?: string | null;
  /** Rótulo Pluggy original. */
  categoryPluggy?: string | null;
}

const CARD_PAYMENT_PLUGGY = new Set(["Credit card payment"]);
const CARD_PAYMENT_REGEX = /pagamento\s*recebido|payment\s*received|fatura\s*paga|pagamento\s*de\s*fatura|pagamento\s*cart[aã]o/i;
const TRANSFER_CATEGORY_REGEX = /^transfer|transfer[eê]ncia|^transfer/i;

/** Pagamento de fatura (entrada CREDIT no cartão OU saída de conta corrente). */
export function isCardPayment(t: TransferTxLike): boolean {
  if (t.categoryPluggy && CARD_PAYMENT_PLUGGY.has(t.categoryPluggy)) return true;
  if (CARD_PAYMENT_REGEX.test(t.description ?? "")) return true;
  if (CARD_PAYMENT_REGEX.test(t.category ?? "")) return true;
  return false;
}

/** Transferência identificada apenas pela categoria. */
export function isInternalTransferByCategory(t: TransferTxLike): boolean {
  const cat = t.category ?? "";
  if (!cat) return false;
  return TRANSFER_CATEGORY_REGEX.test(cat);
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Pareia transferências internas A→B por:
 *   - mesmo valor (tolerância R$ 0,01)
 *   - mesma data (±1 dia para cobrir TED com efetivação D+1)
 *   - contas Pluggy DIFERENTES
 *   - tipos opostos (saida em A, entrada em B)
 *
 * Usa primeiro-encontrado-vence; cada transação só pode parear uma vez.
 */
export function findInternalTransferPairs(
  txs: TransferTxLike[],
): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const consumed = new Set<string>();

  // Indexa entradas por (dayBucket, valor cents) para lookup rápido.
  const inflowsByDayValue = new Map<string, TransferTxLike[]>();
  for (const t of txs) {
    if (t.type !== "entrada") continue;
    if (!t.pluggyAccountId) continue;
    const cents = Math.round(t.value * 100);
    const key = `${dayKey(t.date)}|${cents}`;
    const arr = inflowsByDayValue.get(key) ?? [];
    arr.push(t);
    inflowsByDayValue.set(key, arr);
  }

  const tryFind = (out: TransferTxLike, dayOffset: number): TransferTxLike | null => {
    const d = new Date(out.date);
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + dayOffset);
    const key = `${dayKey(d.toISOString())}|${Math.round(out.value * 100)}`;
    const candidates = inflowsByDayValue.get(key);
    if (!candidates) return null;
    for (const c of candidates) {
      if (consumed.has(c.id)) continue;
      if (!c.pluggyAccountId || !out.pluggyAccountId) continue;
      if (c.pluggyAccountId === out.pluggyAccountId) continue;
      // Anti falso-positivo: pagamento de fatura é tratado em outro filtro;
      // não queremos pareá-lo como "transferência interna" aqui.
      if (isCardPayment(c) || isCardPayment(out)) continue;
      return c;
    }
    return null;
  };

  for (const out of txs) {
    if (out.type !== "saida") continue;
    if (!out.pluggyAccountId) continue;
    if (consumed.has(out.id)) continue;

    // Janela ±1 dia: tenta D, D+1, D-1.
    const match =
      tryFind(out, 0) ?? tryFind(out, 1) ?? tryFind(out, -1);
    if (match) {
      consumed.add(out.id);
      consumed.add(match.id);
      pairs.push([out.id, match.id]);
    }
  }

  return pairs;
}

/**
 * Conjunto de IDs que NÃO devem entrar nos totais brutos (entradas/saídas):
 *   - Pagamentos de fatura (ambos os lados, quando visíveis).
 *   - Transferências internas detectadas por categoria.
 *   - Transferências internas detectadas por matching A→B.
 */
export function excludeNonCashFlowIds(txs: TransferTxLike[]): Set<string> {
  const out = new Set<string>();
  for (const t of txs) {
    if (isCardPayment(t)) out.add(t.id);
    else if (isInternalTransferByCategory(t)) out.add(t.id);
  }
  // Matching A→B só sobre o que ainda não foi excluído.
  const remaining = txs.filter((t) => !out.has(t.id));
  const pairs = findInternalTransferPairs(remaining);
  for (const [a, b] of pairs) {
    out.add(a);
    out.add(b);
  }
  return out;
}