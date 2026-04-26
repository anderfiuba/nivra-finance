import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function* walk(dir: string): Generator<string> {
  let st; try { st = statSync(dir); } catch { return; }
  if (st.isFile()) { yield dir; return; }
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    yield* walk(join(dir, e));
  }
}

// Heurística: console.log(...) com `transaction`, `description`, `amount`,
// `email`, `password`, `token`, `apiKey` no payload é proibido em prod.
const RISKY = /console\.(log|info|warn|error|debug)\([^)]*\b(password|apiKey|api_key|token|access_token|refresh_token|jwt|bank_password|tax_number|cpf)\b/i;

describe("[SEC] Sanitização de logs", () => {
  const hits: { file: string; line: string }[] = [];
  for (const root of ["src", "supabase/functions"]) {
    for (const file of walk(root)) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      if (file.includes("/test/")) continue;
      const c = readFileSync(file, "utf8");
      c.split("\n").forEach((line) => {
        if (RISKY.test(line)) hits.push({ file, line: line.trim() });
      });
    }
  }
  it("não há console.log com tokens/senhas/CPF/segredos", () => {
    expect(hits, JSON.stringify(hits, null, 2)).toEqual([]);
  });
});