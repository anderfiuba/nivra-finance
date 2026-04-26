import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

describe("[SEC] Configuração de autenticação", () => {
  it("HIBP ativo no config.toml", () => {
    const cfg = readFileSync("supabase/config.toml", "utf8");
    expect(cfg).toMatch(/password_hibp_enabled\s*=\s*true/);
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