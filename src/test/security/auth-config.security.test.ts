import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

// HIBP é ativado no painel auth do Lovable Cloud (não no config.toml).
// Aqui validamos as garantias que cabem no repo.
describe("[SEC] Configuração de autenticação", () => {
  it("Edge functions críticas requerem JWT (verify_jwt = true)", () => {
    const cfg = readFileSync("supabase/config.toml", "utf8");
    for (const fn of [
      "pluggy-connect-token",
      "pluggy-list-items",
      "pluggy-register-item",
      "pluggy-sync-data",
      "pluggy-delete-item",
      "account-export",
      "account-delete",
    ]) {
      const block = new RegExp(
        `\\[functions\\.${fn}\\][\\s\\S]*?verify_jwt\\s*=\\s*true`,
      );
      expect(cfg, `Bloco verify_jwt=true ausente para ${fn}`).toMatch(block);
    }
  });

  it("Não usamos signInAnonymously no app", () => {
    if (!existsSync("src/contexts/AuthContext.tsx")) return;
    const c = readFileSync("src/contexts/AuthContext.tsx", "utf8");
    expect(c).not.toMatch(/signInAnonymously/);
  });

  it("ProtectedRoute existe e referencia auth", () => {
    expect(existsSync("src/components/ProtectedRoute.tsx")).toBe(true);
    const c = readFileSync("src/components/ProtectedRoute.tsx", "utf8");
    expect(c).toMatch(/useAuth|user|session/);
  });
});