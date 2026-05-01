import { describe, expect, it } from "vitest";
import { buildPluggyRedirectUri } from "@/pages/app/Conexoes";

describe("[REG] Pluggy mobile Open Finance redirect", () => {
  it("retorna o usuário para a tela de conexões após OAuth do banco", () => {
    expect(buildPluggyRedirectUri("https://nivrafinance.com")).toBe(
      "https://nivrafinance.com/app/conexoes",
    );
  });
});
