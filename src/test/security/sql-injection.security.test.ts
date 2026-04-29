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

/** API.5 — proibido executar SQL arbitrário vindo de input. */
describe("[SEC] Sem execução de SQL arbitrário", () => {
  const offenders: { file: string; line: string }[] = [];
  const RISK = /(rpc\(\s*["']execute_sql["']|\.sql\s*=\s*req\.|raw\(.*\$\{)/i;
  for (const root of ["src", "supabase/functions"]) {
    for (const file of walk(root)) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      if (file.includes("/test/")) continue;
      const c = readFileSync(file, "utf8");
      for (const line of c.split("\n")) {
        if (RISK.test(line)) offenders.push({ file, line: line.trim() });
      }
    }
  }
  it("zero pontos de SQL arbitrário", () => {
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });
});