import { describe, it, expect } from "vitest";

// Replica a lógica de PlanGate / SubscriptionContext em forma testável.
function isActive(row: { status: string; current_period_end: string | null } | null): boolean {
  if (!row) return false;
  const futureOrNull =
    !row.current_period_end || new Date(row.current_period_end).getTime() > Date.now();
  if (["active", "trialing", "past_due"].includes(row.status) && futureOrNull) return true;
  if (
    row.status === "canceled" &&
    row.current_period_end &&
    new Date(row.current_period_end).getTime() > Date.now()
  ) {
    return true;
  }
  return false;
}

function resolvePlan(row: { status: string; price_id: string; current_period_end: string | null } | null) {
  return isActive(row) && row?.price_id === "plus_monthly" ? "plus" : "free";
}

describe("[REG] Plan access", () => {
  const future = new Date(Date.now() + 86400_000).toISOString();
  const past = new Date(Date.now() - 86400_000).toISOString();

  it("sem assinatura → free", () => {
    expect(resolvePlan(null)).toBe("free");
  });

  it("active + price plus_monthly → plus", () => {
    expect(resolvePlan({ status: "active", price_id: "plus_monthly", current_period_end: future })).toBe("plus");
  });

  it("canceled com vigência futura → plus (grace period)", () => {
    expect(resolvePlan({ status: "canceled", price_id: "plus_monthly", current_period_end: future })).toBe("plus");
  });

  it("canceled com vigência passada → free", () => {
    expect(resolvePlan({ status: "canceled", price_id: "plus_monthly", current_period_end: past })).toBe("free");
  });

  it("active mas price_id desconhecido → free (defesa contra preços antigos)", () => {
    expect(resolvePlan({ status: "active", price_id: "legacy_pro", current_period_end: future })).toBe("free");
  });

  it("past_due com vigência futura → plus (Stripe ainda retentando)", () => {
    expect(resolvePlan({ status: "past_due", price_id: "plus_monthly", current_period_end: future })).toBe("plus");
  });
});

describe("[REG] Free connection limit", () => {
  function canAddConnection(plan: "free" | "plus", currentCount: number): boolean {
    if (plan === "plus") return true;
    return currentCount < 1;
  }

  it("Free com 0 conexões pode adicionar", () => {
    expect(canAddConnection("free", 0)).toBe(true);
  });
  it("Free com 1 conexão NÃO pode adicionar", () => {
    expect(canAddConnection("free", 1)).toBe(false);
  });
  it("Free legado com 3 conexões NÃO pode adicionar (grandfather: mantém, mas bloqueia novas)", () => {
    expect(canAddConnection("free", 3)).toBe(false);
  });
  it("Plus pode adicionar sempre", () => {
    expect(canAddConnection("plus", 50)).toBe(true);
  });
});