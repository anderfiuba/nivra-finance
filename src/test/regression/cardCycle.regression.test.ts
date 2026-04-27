import { describe, it, expect } from "vitest";
import {
  resolveCycleDays,
  computeCurrentCycleWindow,
  computeNextCycleWindow,
  daysUntil,
  formatDueLabel,
  formatShortDateFromIso,
  computeCycleWindowFor,
  normalizeCycleDayForMonth,
} from "@/lib/cardCycle";

describe("[REG] Cartão de crédito — ciclos", () => {
  it("override manual prevalece sobre dados da Pluggy", () => {
    const r = resolveCycleDays(
      { balanceCloseDate: "2026-04-08", balanceDueDate: "2026-04-15" },
      { closingDay: 20, dueDay: 28 },
    );
    expect(r).toEqual({ closingDay: 20, dueDay: 28 });
  });

  it("cai pra Pluggy quando manual ausente", () => {
    const r = resolveCycleDays(
      { balanceCloseDate: "2026-04-08", balanceDueDate: "2026-04-15" },
      null,
    );
    expect(r).toEqual({ closingDay: 8, dueDay: 15 });
  });

  it("retorna null quando nada disponível (UI deve pedir manual)", () => {
    expect(resolveCycleDays({ balanceCloseDate: null, balanceDueDate: null }, null)).toBeNull();
  });

  it("janela atual: ref 10/abr (refD>closing), fech 8 → start 09/abr, close 08/mai", () => {
    const w = computeCurrentCycleWindow({ closingDay: 8, dueDay: 15 }, new Date(2026, 3, 10));
    expect(w.start.getDate()).toBe(9);
    expect(w.start.getMonth()).toBe(3); // abr
    expect(w.closingDate.getDate()).toBe(8);
    expect(w.closingDate.getMonth()).toBe(4); // mai
    // due (15) > closing (8) → mesmo mês de fechamento
    expect(w.dueDate.getDate()).toBe(15);
    expect(w.dueDate.getMonth()).toBe(4);
  });

  it("vencimento antes do fechamento → mês seguinte", () => {
    const w = computeCurrentCycleWindow({ closingDay: 25, dueDay: 5 }, new Date(2026, 3, 1));
    // closingDate = abril 25; dueDate = maio 5
    expect(w.dueDate.getMonth()).toBe(4);
    expect(w.dueDate.getDate()).toBe(5);
  });

  it("ciclo seguinte é exatamente após o atual", () => {
    const days = { closingDay: 8, dueDay: 15 };
    const cur = computeCurrentCycleWindow(days, new Date(2026, 3, 10));
    const nxt = computeNextCycleWindow(days, cur);
    expect(nxt.start.getTime()).toBeGreaterThan(cur.closingDate.getTime());
  });

  it("daysUntil/formatDueLabel produzem strings esperadas", () => {
    const ref = new Date(2026, 3, 10);
    expect(daysUntil(new Date(2026, 3, 10), ref)).toBe(0);
    expect(formatDueLabel(new Date(2026, 3, 10), ref)).toBe("Vence hoje");
    expect(formatDueLabel(new Date(2026, 3, 11), ref)).toBe("Vence em 1 dia");
    expect(formatDueLabel(new Date(2026, 3, 7), ref)).toBe("Vencida há 3 dias");
  });

  it("formatShortDateFromIso é TZ-safe", () => {
    expect(formatShortDateFromIso("2026-04-08")).toBe("08/04");
    expect(formatShortDateFromIso(null)).toBe("—");
    expect(formatShortDateFromIso("xx")).toBe("—");
  });

  // ===== Normalização para meses curtos (mesma regra do ciclo do usuário) =====

  it("normalizeCycleDayForMonth: 31 em fev/2025 (não bissexto) → 28", () => {
    expect(normalizeCycleDayForMonth(31, 2025, 1)).toBe(28);
  });

  it("normalizeCycleDayForMonth: 31 em fev/2024 (bissexto) → 29", () => {
    expect(normalizeCycleDayForMonth(31, 2024, 1)).toBe(29);
  });

  it("normalizeCycleDayForMonth: 31 em abril (30 dias) → 30", () => {
    expect(normalizeCycleDayForMonth(31, 2026, 3)).toBe(30);
  });

  it("fechamento 31 em fev/2025 → janela fecha em 28/fev", () => {
    const w = computeCycleWindowFor({ closingDay: 31, dueDay: 10 }, new Date(2025, 1, 10));
    expect(w.closingDate.getDate()).toBe(28);
    expect(w.closingDate.getMonth()).toBe(1); // fev
    // start = dia seguinte ao fechamento de jan (31) → 01/fev
    expect(w.start.getDate()).toBe(1);
    expect(w.start.getMonth()).toBe(1);
  });

  it("fechamento 31 em fev/2024 (bissexto) → fecha em 29/fev", () => {
    const w = computeCycleWindowFor({ closingDay: 31, dueDay: 10 }, new Date(2024, 1, 10));
    expect(w.closingDate.getDate()).toBe(29);
    expect(w.closingDate.getMonth()).toBe(1);
  });

  it("fechamento 30 em fev/2025 → fecha em 28/fev", () => {
    const w = computeCycleWindowFor({ closingDay: 30, dueDay: 5 }, new Date(2025, 1, 15));
    expect(w.closingDate.getDate()).toBe(28);
    expect(w.closingDate.getMonth()).toBe(1);
  });

  it("continuidade: dia seguinte ao fechamento de um ciclo = início do próximo", () => {
    const days = { closingDay: 31, dueDay: 10 };
    const cur = computeCycleWindowFor(days, new Date(2025, 1, 10)); // fechou 28/fev
    const nxt = computeNextCycleWindow(days, cur);
    // Próximo start deve ser 01/mar
    expect(nxt.start.getDate()).toBe(1);
    expect(nxt.start.getMonth()).toBe(2); // mar
    // Próximo fechamento = 31/mar (mês cheio)
    expect(nxt.closingDate.getDate()).toBe(31);
    expect(nxt.closingDate.getMonth()).toBe(2);
  });
});