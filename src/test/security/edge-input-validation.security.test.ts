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
 * API.2 — Toda edge function que recebe body precisa validar tipos antes
 * de usar. Heurística: se há `await req.json()`, deve haver pelo menos
 * uma checagem `typeof ... === "string"` ou `bad_request` ou `safeParse`.
 *
 * Exceções permitidas (anotadas):
 *   - pluggy-connect-token: body é opcional, contém apenas `itemId` que
 *     é repassado para a Pluggy como string. Aceita-se a verificação
 *     truthy `if (body.itemId)` desde que o tipo TS esteja declarado.
 */
const ALLOWLIST = new Set<string>([
  "supabase/functions/pluggy-connect-token/index.ts",
]);
describe("[SEC] Edge functions — validação de input", () => {
  const offenders: string[] = [];
  for (const file of walk("supabase/functions")) {
    if (!file.endsWith("/index.ts")) continue;
    if (file.includes("/_shared/")) continue;
    if (ALLOWLIST.has(file)) continue;
    const c = readFileSync(file, "utf8");
    if (!/await\s+req\.json\(/.test(c)) continue;
    const validates =
      /typeof\s+\w+\s*===?\s*["']string["']/.test(c) ||
      /bad_request/.test(c) ||
      /\.safeParse\(|z\.object\(/.test(c);
    if (!validates) offenders.push(file);
  }
  it("toda função que lê body também valida o body", () => {
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });
});