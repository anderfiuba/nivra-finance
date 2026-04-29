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
 * Mitigação para AUTH.12 (token em localStorage): se o app não tem
 * superfície de XSS, o risco prático de roubo de token via script
 * malicioso é baixo. Este teste enforça esse pacto.
 */
describe("[SEC] Superfície de XSS no app", () => {
  it("nenhum dangerouslySetInnerHTML com conteúdo dinâmico do usuário", () => {
    const offenders: string[] = [];
    for (const file of walk("src")) {
      if (!/\.(tsx|ts)$/.test(file)) continue;
      if (file.includes("/test/")) continue;
      if (file.includes("src/components/ui/")) continue; // shadcn primitives são auditados upstream
      const c = readFileSync(file, "utf8");
      if (/dangerouslySetInnerHTML/.test(c)) offenders.push(file);
    }
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });

  it("nenhum eval / new Function / setTimeout-string", () => {
    const offenders: { file: string; line: string }[] = [];
    const RISK = /(\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*["'`])/;
    for (const file of walk("src")) {
      if (!/\.(tsx|ts)$/.test(file)) continue;
      if (file.includes("/test/")) continue;
      const c = readFileSync(file, "utf8");
      for (const line of c.split("\n")) {
        if (RISK.test(line)) offenders.push({ file, line: line.trim() });
      }
    }
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });
});