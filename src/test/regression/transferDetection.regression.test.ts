import { describe, it, expect } from "vitest";
import {
  excludeNonCashFlowIds,
  findInternalTransferPairs,
  isCardPayment,
  isInternalTransferByCategory,
  type TransferTxLike,
} from "@/lib/transferDetection";

const tx = (over: Partial<TransferTxLike>): TransferTxLike => ({
  id: "x",
  date: "2026-04-10T12:00:00.000Z",
  description: "",
  category: "",
  value: 100,
  type: "saida",
  pluggyAccountId: "acc-A",
  categoryPluggy: null,
  ...over,
});

describe("[REG] transferDetection — pagamento de fatura", () => {
  it("identifica via categoryPluggy oficial", () => {
    expect(isCardPayment(tx({ categoryPluggy: "Credit card payment", type: "entrada" }))).toBe(true);
  });

  it("identifica via descrição (PT/EN)", () => {
    expect(isCardPayment(tx({ description: "Pagamento de fatura Nubank" }))).toBe(true);
    expect(isCardPayment(tx({ description: "Payment received" }))).toBe(true);
  });

  it("não confunde compra normal com pagamento", () => {
    expect(isCardPayment(tx({ description: "iFood Restaurante" }))).toBe(false);
  });
});

describe("[REG] transferDetection — transferência por categoria", () => {
  it("captura 'Transferência'", () => {
    expect(isInternalTransferByCategory(tx({ category: "Transferências" }))).toBe(true);
    expect(isInternalTransferByCategory(tx({ category: "Transfer" }))).toBe(true);
  });
  it("não captura outras categorias", () => {
    expect(isInternalTransferByCategory(tx({ category: "Alimentação" }))).toBe(false);
  });
});

describe("[REG] transferDetection — matching A→B", () => {
  it("pareia saída em A com entrada em B mesmo dia / mesmo valor", () => {
    const list: TransferTxLike[] = [
      tx({ id: "out", type: "saida", pluggyAccountId: "A", value: 500, date: "2026-04-10T08:00:00Z" }),
      tx({ id: "in", type: "entrada", pluggyAccountId: "B", value: 500, date: "2026-04-10T09:00:00Z" }),
    ];
    const pairs = findInternalTransferPairs(list);
    expect(pairs).toEqual([["out", "in"]]);
  });

  it("aceita janela ±1 dia (TED D+1)", () => {
    const list: TransferTxLike[] = [
      tx({ id: "out", type: "saida", pluggyAccountId: "A", value: 1200, date: "2026-04-10T17:00:00Z" }),
      tx({ id: "in", type: "entrada", pluggyAccountId: "B", value: 1200, date: "2026-04-11T10:00:00Z" }),
    ];
    expect(findInternalTransferPairs(list)).toEqual([["out", "in"]]);
  });

  it("NÃO pareia se contas iguais (mesma conta, não é transferência)", () => {
    const list: TransferTxLike[] = [
      tx({ id: "a", type: "saida", pluggyAccountId: "A", value: 100 }),
      tx({ id: "b", type: "entrada", pluggyAccountId: "A", value: 100 }),
    ];
    expect(findInternalTransferPairs(list)).toEqual([]);
  });

  it("NÃO pareia valores diferentes", () => {
    const list: TransferTxLike[] = [
      tx({ id: "a", type: "saida", pluggyAccountId: "A", value: 100 }),
      tx({ id: "b", type: "entrada", pluggyAccountId: "B", value: 99.5 }),
    ];
    expect(findInternalTransferPairs(list)).toEqual([]);
  });

  it("não pareia pagamento de fatura como transferência", () => {
    const list: TransferTxLike[] = [
      tx({ id: "out", type: "saida", pluggyAccountId: "A", value: 800, description: "Pagamento de fatura Nubank" }),
      tx({ id: "in", type: "entrada", pluggyAccountId: "B", value: 800, categoryPluggy: "Credit card payment" }),
    ];
    expect(findInternalTransferPairs(list)).toEqual([]);
  });

  it("cada transação só pareia uma vez", () => {
    const list: TransferTxLike[] = [
      tx({ id: "out", type: "saida", pluggyAccountId: "A", value: 200, date: "2026-04-10T08:00:00Z" }),
      tx({ id: "in1", type: "entrada", pluggyAccountId: "B", value: 200, date: "2026-04-10T09:00:00Z" }),
      tx({ id: "in2", type: "entrada", pluggyAccountId: "C", value: 200, date: "2026-04-10T10:00:00Z" }),
    ];
    const pairs = findInternalTransferPairs(list);
    expect(pairs.length).toBe(1);
  });
});

describe("[REG] excludeNonCashFlowIds — set agregado", () => {
  it("exclui pagamento de fatura + transferência por categoria + matching A→B", () => {
    const list: TransferTxLike[] = [
      tx({ id: "salario", type: "entrada", pluggyAccountId: "A", value: 5000, category: "Salário" }),
      tx({ id: "mercado", type: "saida", pluggyAccountId: "A", value: 350, category: "Alimentação" }),
      tx({ id: "pgto-fatura", type: "saida", pluggyAccountId: "A", value: 2000, description: "Pagamento de fatura Nubank" }),
      tx({ id: "fatura-credit", type: "entrada", pluggyAccountId: "CARD", value: 2000, categoryPluggy: "Credit card payment" }),
      tx({ id: "transf-cat", type: "saida", pluggyAccountId: "A", value: 100, category: "Transferências" }),
      tx({ id: "ted-out", type: "saida", pluggyAccountId: "A", value: 1500, date: "2026-04-10T08:00:00Z" }),
      tx({ id: "ted-in", type: "entrada", pluggyAccountId: "B", value: 1500, date: "2026-04-10T09:00:00Z" }),
    ];
    const excluded = excludeNonCashFlowIds(list);
    expect(excluded.has("salario")).toBe(false);
    expect(excluded.has("mercado")).toBe(false);
    expect(excluded.has("pgto-fatura")).toBe(true);
    expect(excluded.has("fatura-credit")).toBe(true);
    expect(excluded.has("transf-cat")).toBe(true);
    expect(excluded.has("ted-out")).toBe(true);
    expect(excluded.has("ted-in")).toBe(true);
  });
});

describe("[REG] computeTotals — cenário sintético end-to-end (anti double-counting)", () => {
  // Replica computeTotals do FinanceContext para validar comportamento esperado.
  // Mantido aqui como contrato — se mudar lá, mudar aqui também.
  function computeTotalsLite(list: TransferTxLike[]) {
    const excluded = excludeNonCashFlowIds(list);
    let entradas = 0;
    let saidas = 0;
    for (const t of list) {
      if (excluded.has(t.id)) continue;
      if (t.type === "entrada") entradas += t.value;
      else saidas += Math.abs(t.value);
    }
    return { entradas, saidas, saldo: entradas - saidas };
  }

  it("cenário real: salário + despesa + transferência interna + pagamento de fatura", () => {
    const list: TransferTxLike[] = [
      tx({ id: "salario", type: "entrada", pluggyAccountId: "A", value: 5000, category: "Salário" }),
      tx({ id: "aluguel", type: "saida", pluggyAccountId: "A", value: 1800, category: "Moradia" }),
      // Transferência A → B (R$ 1000) — não é gasto novo
      tx({ id: "ted-out", type: "saida", pluggyAccountId: "A", value: 1000, date: "2026-04-10T08:00:00Z" }),
      tx({ id: "ted-in", type: "entrada", pluggyAccountId: "B", value: 1000, date: "2026-04-10T09:00:00Z" }),
      // Pagamento de fatura R$ 800 — não é gasto novo (gasto já contado quando feito no cartão)
      tx({ id: "pgto", type: "saida", pluggyAccountId: "A", value: 800, description: "Pagamento de fatura" }),
      tx({ id: "credit-side", type: "entrada", pluggyAccountId: "CARD", value: 800, categoryPluggy: "Credit card payment" }),
    ];
    const t = computeTotalsLite(list);
    expect(t.entradas).toBe(5000);
    expect(t.saidas).toBe(1800);
    expect(t.saldo).toBe(3200);
  });

  it("comportamento ANTIGO (sem exclusão) inflaria os totais — confirma o bug que estamos corrigindo", () => {
    const list: TransferTxLike[] = [
      tx({ id: "ted-out", type: "saida", pluggyAccountId: "A", value: 1000 }),
      tx({ id: "ted-in", type: "entrada", pluggyAccountId: "B", value: 1000 }),
    ];
    let bruteEntradas = 0;
    let bruteSaidas = 0;
    for (const t of list) {
      if (t.type === "entrada") bruteEntradas += t.value;
      else bruteSaidas += t.value;
    }
    // Antes: 1000/1000 (errado). Depois: 0/0 (certo).
    expect(bruteEntradas).toBe(1000);
    expect(bruteSaidas).toBe(1000);
    const fixed = computeTotalsLite(list);
    expect(fixed.entradas).toBe(0);
    expect(fixed.saidas).toBe(0);
  });
});