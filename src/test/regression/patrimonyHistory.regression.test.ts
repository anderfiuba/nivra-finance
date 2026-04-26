import { describe, it, expect } from "vitest";
import {
  buildPatrimonyHistory,
  type PatrimonyAccountInput,
  type PatrimonyTransactionInput,
} from "@/lib/patrimonyHistory";

const REF = new Date("2026-04-26T12:00:00Z");
const day = (offset: number) => {
  const d = new Date(REF);
  d.setDate(REF.getDate() + offset);
  return d.toISOString();
};

describe("[REG] buildPatrimonyHistory — anti-bug 'patrimônio negativo'", () => {
  it("retorna vazio sem contas BANK", () => {
    const r = buildPatrimonyHistory([], [], { referenceDate: REF });
    expect(r.points).toEqual([]);
    expect(r.hasIncompleteHistory).toBe(false);
  });

  it("ignora contas CREDIT (cartão não entra no patrimônio)", () => {
    const accs: PatrimonyAccountInput[] = [
      { pluggyAccountId: "c1", type: "CREDIT", balance: -2000, automaticallyInvestedBalance: null },
    ];
    const r = buildPatrimonyHistory(accs, [], { referenceDate: REF });
    expect(r.points).toEqual([]);
  });

  it("conta BANK saudável: rebobinia corretamente sem produzir negativo", () => {
    const accs: PatrimonyAccountInput[] = [
      { pluggyAccountId: "b1", type: "BANK", balance: 1000, automaticallyInvestedBalance: 0 },
    ];
    const txs: PatrimonyTransactionInput[] = [
      { pluggyAccountId: "b1", date: day(-5), type: "entrada", value: 200 },
      { pluggyAccountId: "b1", date: day(-3), type: "saida", value: 50 },
    ];
    const r = buildPatrimonyHistory(accs, txs, { referenceDate: REF, days: 10 });
    // Hoje = 1000. -1d = 1000 (sem mov). -3d (saída 50) → o saldo "antes" da saída era 1050.
    // -5d (entrada 200) → o saldo "antes" da entrada era 850.
    const last = r.points[r.points.length - 1];
    const first = r.points[0];
    expect(last.value).toBe(1000);
    expect(first.value).toBeGreaterThanOrEqual(0);
    expect(r.hasIncompleteHistory).toBe(false);
  });

  it("CRÍTICO: faz floor a 0 quando rebobinação produziria negativo (Pluggy traz extrato > saldo conhecido)", () => {
    const accs: PatrimonyAccountInput[] = [
      { pluggyAccountId: "b1", type: "BANK", balance: 100, automaticallyInvestedBalance: 0 },
    ];
    // Entrada de 5000 enquanto saldo atual é só 100 → rebobinar daria -4900.
    const txs: PatrimonyTransactionInput[] = [
      { pluggyAccountId: "b1", date: day(-10), type: "entrada", value: 5000 },
    ];
    const r = buildPatrimonyHistory(accs, txs, { referenceDate: REF, days: 30 });
    for (const p of r.points) {
      expect(p.value).toBeGreaterThanOrEqual(0);
    }
    expect(r.hasIncompleteHistory).toBe(true);
  });

  it("CRÍTICO: exclui contas com saldo zero + movimento recente (caso Mercado Pago)", () => {
    const accs: PatrimonyAccountInput[] = [
      { pluggyAccountId: "mp", type: "BANK", balance: 0, automaticallyInvestedBalance: 0 },
      { pluggyAccountId: "nu", type: "BANK", balance: 500, automaticallyInvestedBalance: 0 },
    ];
    const txs: PatrimonyTransactionInput[] = [
      { pluggyAccountId: "mp", date: day(-2), type: "entrada", value: 800 },
      { pluggyAccountId: "mp", date: day(-1), type: "saida", value: 800 },
      { pluggyAccountId: "nu", date: day(-5), type: "entrada", value: 100 },
    ];
    const r = buildPatrimonyHistory(accs, txs, { referenceDate: REF, days: 30 });
    expect(r.excludedZeroBalanceAccounts).toEqual(["mp"]);
    expect(r.hasIncompleteHistory).toBe(true);
    // Hoje = só Nubank (500), MP excluído.
    expect(r.points[r.points.length - 1].value).toBe(500);
  });

  it("não exclui conta legitimamente zerada e sem movimento (conta inativa)", () => {
    const accs: PatrimonyAccountInput[] = [
      { pluggyAccountId: "inativa", type: "BANK", balance: 0, automaticallyInvestedBalance: 0 },
    ];
    const r = buildPatrimonyHistory(accs, [], { referenceDate: REF, days: 30 });
    expect(r.excludedZeroBalanceAccounts).toEqual([]);
    expect(r.points[r.points.length - 1].value).toBe(0);
  });

  it("clipa série à primeira transação confiável (não inventa pontos antes)", () => {
    const accs: PatrimonyAccountInput[] = [
      { pluggyAccountId: "b1", type: "BANK", balance: 200, automaticallyInvestedBalance: 0 },
    ];
    const txs: PatrimonyTransactionInput[] = [
      { pluggyAccountId: "b1", date: day(-10), type: "saida", value: 50 },
    ];
    const r = buildPatrimonyHistory(accs, txs, { referenceDate: REF, days: 90 });
    // Mais antiga = -10d → série tem no máximo 11 pontos
    expect(r.points.length).toBeLessThanOrEqual(11);
  });

  it("considera saldo de poupança automática só uma vez (não duplica com balance)", () => {
    const accs: PatrimonyAccountInput[] = [
      // Nubank: balance JÁ inclui o invested (per nossa convenção de mapping)
      { pluggyAccountId: "nu", type: "BANK", balance: 994.61, automaticallyInvestedBalance: 994.61 },
    ];
    const r = buildPatrimonyHistory(accs, [], { referenceDate: REF, days: 5 });
    expect(r.points[r.points.length - 1].value).toBe(994.61);
  });

  it("universal: funciona para conector arbitrário sem hardcode de banco", () => {
    const accs: PatrimonyAccountInput[] = [
      { pluggyAccountId: "qualquer-banco-novo-x", type: "BANK", balance: 350, automaticallyInvestedBalance: 0 },
    ];
    const txs: PatrimonyTransactionInput[] = [
      { pluggyAccountId: "qualquer-banco-novo-x", date: day(-3), type: "entrada", value: 50 },
    ];
    const r = buildPatrimonyHistory(accs, txs, { referenceDate: REF, days: 10 });
    expect(r.points.length).toBeGreaterThan(0);
    expect(r.points[r.points.length - 1].value).toBe(350);
    expect(r.points[0].value).toBeGreaterThanOrEqual(0);
  });
});
