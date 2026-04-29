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

/**
 * API.3 — Edge functions devem usar `errorResponse(code)` do helper
 * `_shared/errors.ts` em vez de devolver `err.message` direto.
 */
describe("[SEC] Edge functions — sem vazamento de stack/SQL ao cliente", () => {
  const offenders: { file: string; line: string }[] = [];
  // Padrões inseguros: new Response(JSON.stringify({error: err.message})) ou ({error: e.stack})
  const RISK = /JSON\.stringify\(\s*\{[^}]*\b(message|error|details|stack)\b\s*:\s*(err|e|error)\.(message|stack|toString)/i;

  for (const file of walk("supabase/functions")) {
    if (!file.endsWith(".ts")) continue;
    if (file.includes("/_shared/")) continue;
    if (file.includes("/test/")) continue;
    const c = readFileSync(file, "utf8");
    for (const line of c.split("\n")) {
      if (RISK.test(line)) offenders.push({ file, line: line.trim() });
    }
  }

  it("zero respostas de erro com err.message/stack expostos", () => {
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });

  it("helper _shared/errors.ts existe e mascara internals", () => {
    const c = readFileSync("supabase/functions/_shared/errors.ts", "utf8");
    expect(c).toMatch(/SAFE_MESSAGE/);
    expect(c).toMatch(/console\.error/);
  });
});