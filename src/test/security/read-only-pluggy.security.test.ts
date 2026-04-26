import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// PROMESSA: read-only. Garantimos que nenhuma edge function chama endpoints
// transacionais da Pluggy (payments / transfers / pix initiation).
function* walk(dir: string): Generator<string> {
  let st; try { st = statSync(dir); } catch { return; }
  if (st.isFile()) { yield dir; return; }
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    yield* walk(join(dir, e));
  }
}

const TRANSACTIONAL_PATHS = [
  /\/payments?\b/i,
  /\/payment-intents?\b/i,
  /\/transfers?\b/i,
  /\/pix\b/i,
  /\/payment-requests?\b/i,
  /\/boletos?\b/i,
];

describe("[SEC] Open Finance — escopo read-only", () => {
  const hits: { file: string; line: string }[] = [];
  for (const file of walk("supabase/functions")) {
    if (!file.endsWith(".ts")) continue;
    if (file.includes("/test/")) continue;
    const c = readFileSync(file, "utf8");
    for (const line of c.split("\n")) {
      // Só nos preocupamos com chamadas: pluggyFetch("/...") ou fetch(`...api.pluggy.ai/...`)
      if (!/pluggyFetch|api\.pluggy\.ai/i.test(line)) continue;
      for (const re of TRANSACTIONAL_PATHS) {
        if (re.test(line)) hits.push({ file, line: line.trim() });
      }
    }
  }
  it("nenhuma edge function chama endpoints transacionais (pix/transfers/payments)", () => {
    expect(hits, JSON.stringify(hits, null, 2)).toEqual([]);
  });
});