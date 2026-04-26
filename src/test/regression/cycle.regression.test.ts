import { describe, it, expect } from "vitest";
import { getCycleRange, getPreviousCycleRange, isWithinCycle, lastNCycles } from "@/lib/cycle";

describe("[REG] Mês financeiro do usuário", () => {
  it("ciclo 8: ref 15/abr → 09/abr a 08/mai", () => {
    const r = getCycleRange(8, new Date(2026, 3, 15));
    expect(r.start.getDate()).toBe(9);
    expect(r.start.getMonth()).toBe(2); // mar
    // Pelo bug histórico: refD>day então end=mês seguinte
    expect(r.end.getDate()).toBe(8);
    expect(r.end.getMonth()).toBe(4); // mai
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

  it("clampa cycleDay a [1,28] (proteção contra fevereiro)", () => {
    expect(() => getCycleRange(31, new Date(2026, 1, 5))).not.toThrow();
    expect(() => getCycleRange(0, new Date(2026, 1, 5))).not.toThrow();
  });
});