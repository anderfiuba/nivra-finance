import { describe, it, expect } from "vitest";
import {
  mapPluggyAccountToRow,
  type PluggyAccountInput,
} from "@/lib/pluggyAccountMapping";

// Fixtures REAIS capturadas em produção via Pluggy /accounts (2026-04-26).
// Mantemos os payloads canônicos de cada classe de conector para garantir
// que NUNCA regridamos no mapeamento de saldo, limite e datas de fatura.

const MERCADO_PAGO_BANK: PluggyAccountInput = {
  id: "e4d7b187-1f01-4401-adb4-8306f7c1cd11",
  itemId: "c174975c-1e46-4708-b954-3310d0423254",
  type: "BANK",
  subtype: "CHECKING_ACCOUNT",
  name: "BENJAMIMNOGUEIRA",
  balance: 0,
  currencyCode: "BRL",
  number: "177395982",
  owner: "Benjamim Nogueira Da Silva",
  bankData: {
    transferNumber: "323/177395982",
    closingBalance: 0,
    automaticallyInvestedBalance: null,
    overdraftContractedLimit: null,
    overdraftUsedLimit: null,
  },
  creditData: null,
};

const NUBANK_BANK: PluggyAccountInput = {
  id: "1c3631bd-8a40-49b5-bcfc-2ab69218ed71",
  itemId: "d8ca006c-8343-4d68-b536-7aa0380d5455",
  type: "BANK",
  subtype: "CHECKING_ACCOUNT",
  name: "Nu Pagamentos S.A. - Instituição de Pagamento",
  balance: 994.61,
  currencyCode: "BRL",
  bankData: {
    closingBalance: 994.61,
    automaticallyInvestedBalance: 994.61,
    overdraftContractedLimit: 0,
    overdraftUsedLimit: 0,
  },
  creditData: null,
};

const NUBANK_CREDIT: PluggyAccountInput = {
  id: "dcf948d2-d8ea-45c6-ac09-8b1c3e0703c6",
  itemId: "d8ca006c-8343-4d68-b536-7aa0380d5455",
  type: "CREDIT",
  subtype: "CREDIT_CARD",
  name: "platinum",
  balance: 663.04,
  currencyCode: "BRL",
  number: "1234",
  bankData: null,
  creditData: {
    level: "PLATINUM",
    brand: "MASTERCARD",
    creditLimit: 750,
    availableCreditLimit: 86.96,
    balanceCloseDate: null,
    balanceDueDate: "2026-04-15",
    minimumPayment: 0,
  },
};

describe("[REG] mapPluggyAccountToRow — contrato fonte→banco", () => {
  it("BANK: persiste balance literal e bankData (Nubank)", () => {
    const row = mapPluggyAccountToRow(NUBANK_BANK, "u1", "i1");
    expect(row.balance).toBe(994.61);
    expect(row.automatically_invested_balance).toBe(994.61);
    expect(row.bank_overdraft_limit).toBe(0);
    expect(row.bank_overdraft_used).toBe(0);
    // Campos de crédito devem ficar null em conta BANK
    expect(row.credit_limit).toBeNull();
    expect(row.balance_due_date).toBeNull();
    expect(row.card_brand).toBeNull();
    expect(row.card_number_last4).toBeNull();
  });

  it("BANK: respeita zero literal sem 'consertar' (Mercado Pago)", () => {
    // Anti-regressão crítica: caso o cliente tenha saldo zero, NÃO
    // podemos inventar valor a partir do extrato. O zero deve ser
    // persistido e o aviso fica por conta da UI.
    const row = mapPluggyAccountToRow(MERCADO_PAGO_BANK, "u1", "i1");
    expect(row.balance).toBe(0);
    expect(row.automatically_invested_balance).toBeNull();
    expect(row.bank_overdraft_limit).toBeNull();
  });

  it("CREDIT: persiste creditData completo e zera bankData (Nubank cartão)", () => {
    const row = mapPluggyAccountToRow(NUBANK_CREDIT, "u1", "i1");
    expect(row.balance).toBe(663.04);
    expect(row.credit_limit).toBe(750);
    expect(row.available_credit_limit).toBe(86.96);
    expect(row.balance_due_date).toBe("2026-04-15");
    expect(row.minimum_payment).toBe(0);
    expect(row.card_brand).toBe("MASTERCARD");
    expect(row.card_level).toBe("PLATINUM");
    expect(row.card_number_last4).toBe("1234");
    // Bank-only fica null em CREDIT
    expect(row.bank_overdraft_limit).toBeNull();
    expect(row.bank_overdraft_used).toBeNull();
    expect(row.automatically_invested_balance).toBeNull();
  });

  it("balance numérico inválido vira 0 (defensivo)", () => {
    const row = mapPluggyAccountToRow(
      { ...NUBANK_BANK, balance: undefined as unknown as number },
      "u1",
      "i1",
    );
    expect(row.balance).toBe(0);
  });

  it("currency cai para BRL quando ausente", () => {
    const row = mapPluggyAccountToRow(
      { ...NUBANK_BANK, currencyCode: undefined },
      "u1",
      "i1",
    );
    expect(row.currency).toBe("BRL");
  });

  it("type case-insensitive (lowercase 'credit' deve mapear como CREDIT)", () => {
    const row = mapPluggyAccountToRow(
      { ...NUBANK_CREDIT, type: "credit" },
      "u1",
      "i1",
    );
    expect(row.credit_limit).toBe(750);
    expect(row.bank_overdraft_limit).toBeNull();
  });
});