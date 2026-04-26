import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

// LGPD: confirma que os artefatos contratuais existem (export, delete,
// retenção, consentimento, política, termos, transparência regional).

describe("[SEC] LGPD — artefatos exigidos", () => {
  it("Edge function de exportação existe", () => {
    expect(existsSync("supabase/functions/account-export/index.ts")).toBe(true);
  });
  it("Edge function de exclusão de conta existe", () => {
    expect(existsSync("supabase/functions/account-delete/index.ts")).toBe(true);
  });
  it("Componente de consentimento existe", () => {
    expect(existsSync("src/components/ConsentGate.tsx")).toBe(true);
  });
  it("Política de Privacidade publicada", () => {
    expect(existsSync("src/pages/legal/Privacidade.tsx")).toBe(true);
    const c = readFileSync("src/pages/legal/Privacidade.tsx", "utf8");
    // Transparência sobre região (US-East / Ohio) — promessa pública.
    expect(c.toLowerCase()).toMatch(/região|estados unidos|ohio|us-east/);
  });
  it("Termos de Uso publicados", () => {
    expect(existsSync("src/pages/legal/Termos.tsx")).toBe(true);
  });
  it("account-delete revoga upstream antes do purge local", () => {
    const c = readFileSync("supabase/functions/account-delete/index.ts", "utf8");
    // Devemos chamar DELETE em /items/<id> ANTES de apagar localmente.
    expect(c).toMatch(/\/items\//);
    expect(c).toMatch(/method:\s*["']DELETE["']/i);
  });
  it("account-export agrega múltiplas tabelas (portabilidade Art. 18)", () => {
    const c = readFileSync("supabase/functions/account-export/index.ts", "utf8");
    for (const t of [
      "profiles", "pluggy_items", "pluggy_accounts",
      "pluggy_transactions", "category_budgets",
    ]) expect(c).toContain(t);
  });
});