import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Faz chamadas reais usando a chave PUBLISHABLE (anon). Como nenhum usuário
// está logado, RLS deve barrar TODAS as tabelas privadas.
const URL = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const KEY = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const SHOULD_RUN = !!URL && !!KEY;
const d = SHOULD_RUN ? describe : describe.skip;

d("[SEC] RLS bloqueia leitura/escrita anônima nas tabelas sensíveis", () => {
  const sb = createClient(URL!, KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const PRIVATE_TABLES = [
    "profiles",
    "pluggy_items",
    "pluggy_accounts",
    "pluggy_transactions",
    "pluggy_bills",
    "category_budgets",
    "total_budget_settings",
    "card_cycle_settings",
    "audit_log",
    "app_settings",
  ] as const;

  for (const table of PRIVATE_TABLES) {
    it(`${table}: select anônimo retorna 0 linhas`, async () => {
      const { data, error } = await sb.from(table as any).select("*").limit(5);
      // Política deny-all retorna error; owner-scoped retorna [] (sem auth.uid).
      // Ambos são ACEITÁVEIS — o que é INACEITÁVEL é vir dado.
      if (error) expect(error).toBeTruthy();
      else expect(data ?? []).toHaveLength(0);
    });

    it(`${table}: insert anônimo é negado`, async () => {
      const { error } = await sb.from(table as any).insert({ id: crypto.randomUUID() } as any);
      expect(error).toBeTruthy();
    });
  }

  it("pluggy_categories: leitura permitida apenas autenticado (anon falha ou vazio)", async () => {
    const { data, error } = await sb.from("pluggy_categories").select("id").limit(1);
    if (!error) expect(data ?? []).toHaveLength(0);
  });
});