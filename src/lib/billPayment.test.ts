import { describe, it, expect } from "vitest";
import { inferBillPaid, type BillLike, type TxLike } from "./billPayment";

const ACC = "acc-1";

function bill(over: Partial<BillLike> = {}): BillLike {
  return {
    pluggyAccountId: ACC,
    dueDate: "2026-04-08",
    totalAmount: 801.0225,
    paid: false,
    ...over,
  };
}

function tx(over: Partial<TxLike> = {}): TxLike {
  return {
    pluggyAccountId: ACC,
    date: "2026-04-23T07:40:03.248Z",
    description: "Pagamento recebido",
    value: 801.02,
    type: "entrada",
    categoryPluggy: "Credit card payment",
    ...over,
  };
}

describe("inferBillPaid", () => {
  it("matches a payment 15 days after due date even if posted at 07:40 UTC", () => {
    expect(inferBillPaid(bill(), [tx()])).toBe(true);
  });

  it("matches a late payment up to 45 days after due date", () => {
    expect(
      inferBillPaid(bill(), [tx({ date: "2026-05-22T18:00:00Z" })]),
    ).toBe(true);
  });

  it("does NOT match a payment 60 days after due date", () => {
    expect(
      inferBillPaid(bill(), [tx({ date: "2026-06-10T12:00:00Z" })]),
    ).toBe(false);
  });

  it("matches an early payment up to 35 days before due date", () => {
    expect(
      inferBillPaid(bill(), [tx({ date: "2026-03-05T10:00:00Z" })]),
    ).toBe(true);
  });

  it("ignores 'Crédito de parcelamento de compra' even with matching value", () => {
    expect(
      inferBillPaid(bill(), [tx({
        description: "Crédito de parcelamento de compra",
        categoryPluggy: null,
      })]),
    ).toBe(false);
  });

  it("ignores transactions from other accounts", () => {
    expect(
      inferBillPaid(bill(), [tx({ pluggyAccountId: "other-acc" })]),
    ).toBe(false);
  });

  it("returns true when bill.paid is already true", () => {
    expect(inferBillPaid(bill({ paid: true }), [])).toBe(true);
  });

  it("rejects when value is outside tolerance", () => {
    expect(
      inferBillPaid(bill(), [tx({ value: 700 })]),
    ).toBe(false);
  });

  it("matches by category_pluggy alone (description without 'pagamento')", () => {
    expect(
      inferBillPaid(bill(), [tx({ description: "Liquidação fatura" })]),
    ).toBe(true);
  });
});