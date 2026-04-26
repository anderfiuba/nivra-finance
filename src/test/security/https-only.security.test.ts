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

// Permitimos http://localhost (dev) mas não http://<host externo>.
const HTTP_LITERAL = /["'`]http:\/\/(?!localhost|127\.0\.0\.1)[^"'`\s]+/g;

describe("[SEC] Comunicação externa apenas via HTTPS", () => {
  const hits: { file: string; url: string }[] = [];
  for (const root of ["src", "supabase/functions"]) {
    for (const file of walk(root)) {
      if (!/\.(ts|tsx|html)$/.test(file)) continue;
      if (file.includes("/test/")) continue;
      const c = readFileSync(file, "utf8");
      const matches = c.match(HTTP_LITERAL);
      if (matches) for (const m of matches) hits.push({ file, url: m });
    }
  }
  it("nenhuma URL HTTP externa em produção", () => {
    expect(hits, JSON.stringify(hits, null, 2)).toEqual([]);
  });
});