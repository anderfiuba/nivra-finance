import { describe, expect, it } from "vitest";
import { hasPluggySyncData, shouldAutoResyncPluggyItem } from "@/lib/pluggySyncRetry";

describe("[REG] Pluggy sync retry", () => {
  const now = Date.parse("2026-05-01T20:00:00.000Z");

  it("reagenda sync para item recente sem contas, independente do banco", () => {
    expect(
      shouldAutoResyncPluggyItem(
        {
          pluggyItemId: "item-nubank-ou-santander",
          createdAt: "2026-05-01T19:58:00.000Z",
          status: "UPDATED",
          executionStatus: "SUCCESS",
          accountCount: 0,
        },
        now,
      ),
    ).toBe(true);
  });

  it("não reagenda quando já há conta local", () => {
    expect(
      shouldAutoResyncPluggyItem(
        {
          pluggyItemId: "item-com-dados",
          createdAt: "2026-05-01T19:58:00.000Z",
          accountCount: 1,
        },
        now,
      ),
    ).toBe(false);
  });

  it("não reagenda item antigo para evitar sync infinito", () => {
    expect(
      shouldAutoResyncPluggyItem(
        {
          pluggyItemId: "item-antigo",
          createdAt: "2026-05-01T19:00:00.000Z",
          accountCount: 0,
        },
        now,
      ),
    ).toBe(false);
  });

  it("não reagenda quando o banco exige nova ação do usuário", () => {
    expect(
      shouldAutoResyncPluggyItem(
        {
          pluggyItemId: "item-reauth",
          createdAt: "2026-05-01T19:58:00.000Z",
          status: "WAITING_USER_INPUT",
          accountCount: 0,
        },
        now,
      ),
    ).toBe(false);
  });

  it("considera sync bem-sucedido quando qualquer produto retornou dados", () => {
    expect(hasPluggySyncData({ accounts: 0, transactions: 0, bills: 1, investments: 0 })).toBe(true);
    expect(hasPluggySyncData({ accounts: 0, transactions: 0, bills: 0, investments: 0 })).toBe(false);
  });
});