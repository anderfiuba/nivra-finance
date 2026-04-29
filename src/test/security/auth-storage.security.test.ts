import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * TOK.4 — Garantir que o cliente Supabase usa localStorage APENAS para a
 * sessão (token de auth) e que nenhum código persiste PII (CPF, saldo,
 * número de cartão) em localStorage/sessionStorage.
 */

describe("[SEC] Storage do cliente — apenas sessão Supabase", () => {
  it("cliente Supabase configurado com localStorage para auth (esperado)", () => {
    const c = readFileSync("src/integrations/supabase/client.ts", "utf8");
    expect(c).toMatch(/storage:\s*localStorage/);
  });

  it("nenhum localStorage.setItem/sessionStorage.setItem com PII", () => {
    const offenders: { file: string; line: string }[] = [];
    const RISK = /(localStorage|sessionStorage)\.setItem\([^)]*\b(cpf|tax_number|password|saldo|balance|card|cvv|cvc|account_number)\b/i;

    for (const file of walk("src")) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      if (file.includes("/test/")) continue;
      const c = readFileSync(file, "utf8");
      for (const line of c.split("\n")) {
        if (RISK.test(line)) offenders.push({ file, line: line.trim() });
      }
    }
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });
});

function* walk(dir: string): Generator<string> {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  let st;
  try { st = statSync(dir); } catch { return; }
  if (st.isFile()) { yield dir; return; }
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    yield* walk(join(dir, e));
  }
}