import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * API.9 — A função pluggy-sync-data tem dois caminhos de auth:
 *  (a) JWT de usuário ou (b) X-Cron-Secret == CRON_SHARED_SECRET.
 * Garantir que NÃO exista bypass por body (ex: `source: "cron"` antigo).
 */
describe("[SEC] pluggy-sync-data — autenticação dual sem bypass", () => {
  // Remove comentários para não pegar self-references (nosso código documenta
  // o bypass legacy ELIMINADO em comentário).
  const raw = readFileSync("supabase/functions/pluggy-sync-data/index.ts", "utf8");
  const c = raw
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))     // line comments
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");        // block comments

  it("aceita CRON_SHARED_SECRET via header", () => {
    expect(c).toMatch(/CRON_SHARED_SECRET/);
    expect(c).toMatch(/x-cron-secret/i);
  });

  it("aceita JWT via Authorization Bearer", () => {
    expect(c).toMatch(/Authorization/);
    expect(c).toMatch(/Bearer/);
  });

  it("não tem bypass legacy `source: \"cron\"` no body", () => {
    expect(c).not.toMatch(/body\.source\s*===?\s*["']cron["']/);
    expect(c).not.toMatch(/source:\s*["']cron["']/);
  });
});