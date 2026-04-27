import { describe, it, expect } from "vitest";
import {
  getCycleRange,
  getPreviousCycleRange,
  isWithinCycle,
  lastNCycles,
  normalizeCycleDayForMonth,
} from "@/lib/cycle";

describe("[REG] Mês financeiro do usuário", () => {
  it("ciclo 8: ref 15/abr (refD>day) → 09/abr a 08/mai", () => {
    const r = getCycleRange(8, new Date(2026, 3, 15));
    expect(r.start.getDate()).toBe(9);
    expect(r.start.getMonth()).toBe(3); // abr
    expect(r.end.getDate()).toBe(8);
    expect(r.end.getMonth()).toBe(4); // mai
  });

  it("ciclo 8: ref 05/abr (refD<=day) → 09/mar a 08/abr", () => {
    const r = getCycleRange(8, new Date(2026, 3, 5));
    expect(r.start.getDate()).toBe(9);
    expect(r.start.getMonth()).toBe(2); // mar
    expect(r.end.getDate()).toBe(8);
    expect(r.end.getMonth()).toBe(3); // abr
  });

  it("ciclo 1 = mês civil", () => {
    const r = getCycleRange(1, new Date(2026, 3, 15));
    expect(r.start.getMonth()).toBe(3);
    expect(r.end.getMonth()).toBe(4);
  });

  it("ciclo anterior é distinto e contém o dia 1 anterior ao start atual", () => {
    const cur = getCycleRange(10, new Date(2026, 5, 20));
    const prev = getPreviousCycleRange(10, new Date(2026, 5, 20));
    expect(prev.end.getTime()).toBeLessThan(cur.start.getTime());
  });

  it("isWithinCycle inclui borda final", () => {
    const r = getCycleRange(15, new Date(2026, 6, 10));
    const lastDayIso = `${r.end.getFullYear()}-${String(r.end.getMonth() + 1).padStart(2,"0")}-${String(r.end.getDate()).padStart(2,"0")}`;
    expect(isWithinCycle(lastDayIso, r)).toBe(true);
  });

  it("lastNCycles retorna 6 buckets ordenados do mais recente p/ o mais antigo", () => {
    const list = lastNCycles(6, 8, new Date(2026, 6, 1));
    expect(list).toHaveLength(6);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].end.getTime()).toBeGreaterThan(list[i].end.getTime());
    }
  });

  it("aceita cycleDay 1..31 sem lançar exceção", () => {
    expect(() => getCycleRange(31, new Date(2026, 1, 5))).not.toThrow();
    expect(() => getCycleRange(30, new Date(2026, 3, 5))).not.toThrow();
    expect(() => getCycleRange(0, new Date(2026, 1, 5))).not.toThrow();
  });

  // ===== Normalização para o último dia válido do mês =====

  it("normalizeCycleDayForMonth: 31 em fev/2025 (não bissexto) → 28", () => {
    expect(normalizeCycleDayForMonth(31, 2025, 1)).toBe(28);
  });

  it("normalizeCycleDayForMonth: 31 em fev/2024 (bissexto) → 29", () => {
    expect(normalizeCycleDayForMonth(31, 2024, 1)).toBe(29);
  });

  it("normalizeCycleDayForMonth: 30 em fev/2025 → 28", () => {
    expect(normalizeCycleDayForMonth(30, 2025, 1)).toBe(28);
  });

  it("normalizeCycleDayForMonth: 31 em abril (30 dias) → 30", () => {
    expect(normalizeCycleDayForMonth(31, 2026, 3)).toBe(30);
  });

  it("normalizeCycleDayForMonth: 31 em janeiro (31 dias) → 31", () => {
    expect(normalizeCycleDayForMonth(31, 2026, 0)).toBe(31);
  });

  it("ciclo 31: ref 10/fev/2025 → end = 28/fev (não bissexto)", () => {
    const r = getCycleRange(31, new Date(2025, 1, 10));
    expect(r.end.getDate()).toBe(28);
    expect(r.end.getMonth()).toBe(1); // fev
    expect(r.end.getFullYear()).toBe(2025);
    // Start = dia seguinte ao end do ciclo anterior (jan termina em 31).
    expect(r.start.getDate()).toBe(1);
    expect(r.start.getMonth()).toBe(1); // 01/fev
  });

  it("ciclo 31: ref 10/fev/2024 (bissexto) → end = 29/fev", () => {
    const r = getCycleRange(31, new Date(2024, 1, 10));
    expect(r.end.getDate()).toBe(29);
    expect(r.end.getMonth()).toBe(1);
    expect(r.end.getFullYear()).toBe(2024);
  });

  it("ciclo 30: ref 15/abr/2026 (após dia 30 não existe → end no próprio mês 30/abr)", () => {
    const r = getCycleRange(30, new Date(2026, 3, 15));
    expect(r.end.getDate()).toBe(30);
    expect(r.end.getMonth()).toBe(3); // abr
  });

  it("ciclo 31: ref 01/mar/2025 → end = 31/mar (mês de referência tem 31 dias)", () => {
    const r = getCycleRange(31, new Date(2025, 2, 1));
    expect(r.end.getDate()).toBe(31);
    expect(r.end.getMonth()).toBe(2);
    // Start = 01/mar (pois fev/2025 termina em 28 → +1 dia = 01/mar).
    expect(r.start.getDate()).toBe(1);
    expect(r.start.getMonth()).toBe(2);
  });

  it("continuidade: end de um ciclo + 1 dia = start do próximo (sem buracos)", () => {
    // Cobre transição fev→mar com cycleDay=31.
    const feb = getCycleRange(31, new Date(2025, 1, 15));
    const mar = getCycleRange(31, new Date(2025, 2, 15));
    const dayAfterFebEnd = new Date(feb.end);
    dayAfterFebEnd.setHours(0, 0, 0, 0);
    dayAfterFebEnd.setDate(dayAfterFebEnd.getDate() + 1);
    expect(mar.start.getTime()).toBe(dayAfterFebEnd.getTime());
  });
});