/**
 * Inferência de pagamento de fatura.
 *
 * A Pluggy raramente atualiza `bill.paid = true` mesmo após o pagamento real
 * aparecer como transação na conta de cartão (CREDIT do tipo "Pagamento
 * recebido"). Para refletir a realidade ao usuário (fatura paga deve sair do
 * "Total a pagar"), inferimos a partir das transações sincronizadas.
 *
 * Regras (todas devem bater para um match):
 *  - Mesma `pluggy_account_id` da bill.
 *  - Transação do tipo CREDIT (pagamento entrando no cartão), OU descrição
 *    matching `pagamento` / `payment received`.
 *  - Valor absoluto dentro de tolerância (default ±2% e mínimo R$ 1) do
 *    `total_amount` da bill.
 *  - Data da transação dentro de [due_date - 30d, due_date + 15d].
 */

export interface BillLike {
  pluggyAccountId: string;
  dueDate: string | null;
  totalAmount: number | null;
  paid: boolean;
}

export interface TxLike {
  pluggyAccountId: string;
  date: string;
  description: string;
  /** Valor sempre positivo (no nosso modelo `Transaction.value`). */
  value: number;
  /** "entrada" = CREDIT no cartão (pagamento recebido). */
  type: "entrada" | "saida";
}

const PAYMENT_REGEX = /pagamento|payment\s*received|fatura\s*paga/i;

export function isLikelyBillPayment(tx: TxLike): boolean {
  if (tx.type !== "entrada") return false;
  return PAYMENT_REGEX.test(tx.description);
}

export interface InferOptions {
  tolerancePct?: number; // default 0.02
  minToleranceAbs?: number; // default 1.0 (R$ 1)
  windowBeforeDays?: number; // default 30
  windowAfterDays?: number; // default 15
  ref?: Date;
}

export function inferBillPaid(bill: BillLike, txs: TxLike[], opts: InferOptions = {}): boolean {
  if (bill.paid) return true;
  if (!bill.dueDate || bill.totalAmount == null || bill.totalAmount <= 0) return false;

  const tolPct = opts.tolerancePct ?? 0.02;
  const tolAbs = Math.max(opts.minToleranceAbs ?? 1, bill.totalAmount * tolPct);
  const before = opts.windowBeforeDays ?? 30;
  const after = opts.windowAfterDays ?? 15;

  const due = new Date(bill.dueDate + "T00:00:00").getTime();
  const lo = due - before * 24 * 60 * 60 * 1000;
  const hi = due + after * 24 * 60 * 60 * 1000;

  for (const tx of txs) {
    if (tx.pluggyAccountId !== bill.pluggyAccountId) continue;
    if (!isLikelyBillPayment(tx)) continue;
    const td = new Date(tx.date).getTime();
    if (td < lo || td > hi) continue;
    if (Math.abs(tx.value - bill.totalAmount) <= tolAbs) return true;
  }
  return false;
}

/**
 * Tenta inferir o dia de fechamento do cartão a partir do histórico de bills.
 * Heurística simples: dia de fechamento ≈ (due_day - 7) mod 28, validado pela
 * recorrência do dia em várias bills. Se houver pelo menos 2 bills com o
 * mesmo dia de vencimento, usamos esse `due_day - 7` (regra empírica do
 * Nubank e da maioria dos bancos BR).
 *
 * Retorna null quando não há informação suficiente.
 */
export function inferClosingDayFromBills(
  bills: Array<{ dueDate: string | null }>,
): { closingDay: number; dueDay: number } | null {
  const counts = new Map<number, number>();
  for (const b of bills) {
    if (!b.dueDate) continue;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(b.dueDate);
    if (!m) continue;
    const d = Number(m[3]);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let bestDay = 0;
  let bestN = 0;
  for (const [d, n] of counts) {
    if (n > bestN) {
      bestN = n;
      bestDay = d;
    }
  }
  if (bestN < 2) return null;
  // Fechamento ~ 7 dias antes do vencimento (Nubank e maioria dos bancos BR).
  let closing = bestDay - 7;
  if (closing < 1) closing += 30;
  closing = Math.max(1, Math.min(28, closing));
  return { closingDay: closing, dueDay: bestDay };
}