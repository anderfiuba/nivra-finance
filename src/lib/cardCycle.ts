/**
 * Utilitários para calcular ciclos de fatura de cartões de crédito.
 *
 * Hierarquia de fontes para os dias de fechamento/vencimento:
 *  1. `card_cycle_settings` (override manual do usuário) — prioridade.
 *  2. `pluggy_accounts.balance_close_date` / `balance_due_date` — dia extraído.
 *  3. Sem dados → cartão exige configuração manual.
 */

export interface CycleDays {
  closingDay: number;
  dueDay: number;
}

export interface CycleWindow {
  /** Início do ciclo (dia seguinte ao fechamento anterior, 00:00). */
  start: Date;
  /** Data do próximo fechamento (23:59). */
  closingDate: Date;
  /** Data do vencimento da fatura desse ciclo (00:00). */
  dueDate: Date;
}

function dayFromIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  // ISO date "YYYY-MM-DD" — extrai o dia direto sem passar por timezone.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = Number(m[3]);
  if (!Number.isFinite(d) || d < 1 || d > 31) return null;
  return Math.min(28, d);
}

export function resolveCycleDays(
  account: {
    balanceCloseDate: string | null;
    balanceDueDate: string | null;
  },
  manual: { closingDay: number | null; dueDay: number | null } | null,
): CycleDays | null {
  const closing = manual?.closingDay ?? dayFromIso(account.balanceCloseDate);
  const due = manual?.dueDay ?? dayFromIso(account.balanceDueDate);
  if (!closing || !due) return null;
  return { closingDay: closing, dueDay: due };
}

/**
 * Janela do ciclo "atual" (aberto): vai do dia seguinte ao fechamento anterior
 * até o próximo fechamento. Vencimento é calculado em seguida.
 */
export function computeCurrentCycleWindow(days: CycleDays, ref: Date = new Date()): CycleWindow {
  return computeCycleWindowFor(days, ref);
}

/** Janela do ciclo que CONTÉM `ref` (qualquer data). */
export function computeCycleWindowFor(days: CycleDays, ref: Date): CycleWindow {
  const closing = clampDay(days.closingDay);
  const due = clampDay(days.dueDay);

  // Próximo fechamento >= ref
  const refY = ref.getFullYear();
  const refM = ref.getMonth();
  const refD = ref.getDate();

  let closeY: number;
  let closeM: number;
  if (refD <= closing) {
    closeY = refY;
    closeM = refM;
  } else {
    closeM = refM + 1;
    closeY = refY;
    if (closeM > 11) {
      closeM = 0;
      closeY += 1;
    }
  }
  const closingDate = new Date(closeY, closeM, closing, 23, 59, 59, 999);

  // Início = dia seguinte ao fechamento anterior
  let startM = closeM - 1;
  let startY = closeY;
  if (startM < 0) {
    startM = 11;
    startY -= 1;
  }
  const start = new Date(startY, startM, closing + 1, 0, 0, 0, 0);

  // Vencimento: se due >= closing → mesmo mês; senão → mês seguinte.
  let dueY = closeY;
  let dueM = closeM;
  if (due < closing) {
    dueM += 1;
    if (dueM > 11) {
      dueM = 0;
      dueY += 1;
    }
  }
  const dueDate = new Date(dueY, dueM, due, 0, 0, 0, 0);

  return { start, closingDate, dueDate };
}

/** Próximo ciclo (depois do atual). */
export function computeNextCycleWindow(days: CycleDays, current: CycleWindow): CycleWindow {
  const refNext = new Date(current.closingDate.getTime() + 24 * 60 * 60 * 1000);
  return computeCycleWindowFor(days, refNext);
}

function clampDay(n: number): number {
  return Math.max(1, Math.min(28, Math.floor(n)));
}

const MONTHS_PT_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** "08/05" — formato curto pt-BR. */
export function formatShortDate(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

/** "08/05" a partir de "YYYY-MM-DD" (sem passar por TZ). */
export function formatShortDateFromIso(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "—";
  return `${m[3]}/${m[2]}`;
}

/** "08 mai" para selectors longos. */
export function formatShortDateLong(d: Date): string {
  return `${pad2(d.getDate())} ${MONTHS_PT_SHORT[d.getMonth()]}`;
}

/** Dias até `date` (negativo = passou). Trabalha em granularidade de dia. */
export function daysUntil(date: Date, ref: Date = new Date()): number {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const b = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

/** "Vence em 13 dias" / "Vence hoje" / "Vencida há 3 dias". */
export function formatDueLabel(date: Date, ref: Date = new Date()): string {
  const d = daysUntil(date, ref);
  if (d === 0) return "Vence hoje";
  if (d > 0) return `Vence em ${d} ${d === 1 ? "dia" : "dias"}`;
  const abs = Math.abs(d);
  return `Vencida há ${abs} ${abs === 1 ? "dia" : "dias"}`;
}