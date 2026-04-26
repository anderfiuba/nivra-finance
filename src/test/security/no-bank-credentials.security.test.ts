import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// PROMESSA: nunca pedimos senha bancária. Validamos que não há campos de UI
// nem rotas de API capturando "senha do banco" / "credenciais bancárias".
const SCAN_DIRS = ["src", "supabase/functions"];
const FORBIDDEN_LITERALS = [
  /name\s*=\s*["']bank_password["']/i,
  /name\s*=\s*["']bankPassword["']/i,
  /placeholder=["'][^"']*senha do banco/i,
  /placeholder=["'][^"']*senha bancária/i,
  /column.*bank_password/i,
];

function* walk(dir: string): Generator<string> {
  let st;
  try { st = statSync(dir); } catch { return; }
  if (st.isFile()) { yield dir; return; }
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    yield* walk(join(dir, entry));
  }
}

describe("[SEC] Coleta de credenciais bancárias é proibida", () => {
  const hits: { file: string; pattern: string }[] = [];
  for (const root of SCAN_DIRS) {
    for (const file of walk(root)) {
      if (!/\.(ts|tsx|html)$/.test(file)) continue;
      if (file.includes("/test/")) continue;
      const c = readFileSync(file, "utf8");
      for (const re of FORBIDDEN_LITERALS) {
        if (re.test(c)) hits.push({ file, pattern: re.source });
      }
    }
  }
  it("não existe campo/rota capturando senha bancária", () => {
    expect(hits, JSON.stringify(hits, null, 2)).toEqual([]);
  });
});

describe("[SEC] Pluggy é o único provedor Open Finance referenciado", () => {
  it("apenas pluggy é usado como conector financeiro", () => {
    // Sanity: garante que só temos integrações Pluggy. Outros provedores
    // de Open Finance precisariam de auditoria de escopo separada.
    const found: string[] = [];
    for (const root of ["supabase/functions"]) {
      for (const file of walk(root)) {
        if (file.includes("/test/")) continue;
        const c = readFileSync(file, "utf8");
        if (/belvo|finapi|teller|plaid/i.test(c)) found.push(file);
      }
    }
    expect(found, JSON.stringify(found)).toEqual([]);
  });
});