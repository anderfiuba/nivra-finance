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
 * AUTHZ.9 — Hoje o produto não tem roles administrativas. Garantir que
 * ninguém checa role de admin no client (anti-pattern crítico) ou guarda
 * `is_admin` em profile/user_metadata.
 */
describe("[SEC] Sem checagem de admin no client", () => {
  const offenders: { file: string; line: string }[] = [];
  const RISK = /(is_admin|isAdmin|role\s*===?\s*["']admin["']|user_metadata\.\w*admin)/i;

  for (const file of walk("src")) {
    if (!/\.(tsx|ts)$/.test(file)) continue;
    if (file.includes("/test/")) continue;
    const c = readFileSync(file, "utf8");
    for (const line of c.split("\n")) {
      if (RISK.test(line)) offenders.push({ file, line: line.trim() });
    }
  }
  it("nenhuma trilha de admin no client (se virar feature, mover para tabela user_roles)", () => {
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });
});