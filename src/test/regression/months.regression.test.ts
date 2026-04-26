import { describe, it, expect } from "vitest";
import { lastNMonths, monthKeyOf, monthBucketFromKey, currentMonthBucket } from "@/lib/months";

describe("[REG] Extrato — buckets por mês civil", () => {
  it("lastNMonths(3) retorna mês corrente + 2 anteriores", () => {
    const list = lastNMonths(3, new Date(2026, 5, 15));
    expect(list.map((m) => m.key)).toEqual(["2026-06", "2026-05", "2026-04"]);
  });

  it("monthKeyOf é estável em ISO da Pluggy", () => {
    expect(monthKeyOf("2026-04-08T03:00:00.000Z")).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  it("monthBucketFromKey tolera entrada inválida", () => {
    expect(monthBucketFromKey("abc")).toBeNull();
    expect(monthBucketFromKey("2026-13")).toBeNull();
    expect(monthBucketFromKey("2026-07")).not.toBeNull();
  });

  it("currentMonthBucket cobre mês corrente", () => {
    const ref = new Date(2026, 8, 1);
    const b = currentMonthBucket(ref);
    expect(b.month).toBe(8);
    expect(b.year).toBe(2026);
  });
});