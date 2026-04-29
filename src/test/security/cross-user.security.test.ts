import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * AUTHZ.3..6 — Testes cross-user REAIS (criam contas no Lovable Cloud).
 *
 * Opt-in: setar SECURITY_E2E=1 antes de rodar.
 * Sem isso a suíte é skipada para não bater em produção em todo build.
 *
 * Estratégia:
 *   1. signUp dois usuários sintéticos (Alice, Bob).
 *   2. signIn cada um → obter dois supabase clients autenticados.
 *   3. Cada usuário insere uma linha em `category_budgets` (tabela com
 *      RLS owner-scoped — proxy seguro pra validar isolamento).
 *   4. Alice tenta SELECT/UPDATE/DELETE da linha de Bob → deve falhar.
 *   5. Bob valida que a linha dele continua intacta.
 *   6. Teardown: account-delete para ambos.
 *
 * Observação: como o Supabase pode exigir confirmação de email, usamos
 * `signUp` + `signInWithPassword` em sequência. Se o projeto exigir email
 * confirm, este teste será SKIP com aviso (não temos como confirmar
 * email programaticamente sem service role).
 */

const URL = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const KEY = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const E2E = (import.meta as any).env?.SECURITY_E2E === "1" || process.env.SECURITY_E2E === "1";

const SHOULD_RUN = !!URL && !!KEY && E2E;
const d = SHOULD_RUN ? describe : describe.skip;

function rand() { return Math.random().toString(36).slice(2, 10); }

d("[SEC] AUTHZ cross-user — Alice não acessa dados de Bob", () => {
  const tag = `nivra-sec-${Date.now()}-${rand()}`;
  const aliceEmail = `${tag}-a@example.test`;
  const bobEmail = `${tag}-b@example.test`;
  const password = `Test!${rand()}${rand()}`;

  let aliceClient!: SupabaseClient;
  let bobClient!: SupabaseClient;
  let aliceUserId = "";
  let bobUserId = "";
  let bobBudgetId = "";

  beforeAll(async () => {
    aliceClient = createClient(URL!, KEY!, { auth: { persistSession: false } });
    bobClient = createClient(URL!, KEY!, { auth: { persistSession: false } });

    const a = await aliceClient.auth.signUp({ email: aliceEmail, password });
    const b = await bobClient.auth.signUp({ email: bobEmail, password });
    if (a.error) throw new Error(`signUp Alice falhou: ${a.error.message}`);
    if (b.error) throw new Error(`signUp Bob falhou: ${b.error.message}`);

    // Se signUp não logou (email confirm), tentar login direto:
    if (!a.data.session) {
      const r = await aliceClient.auth.signInWithPassword({ email: aliceEmail, password });
      if (r.error) throw new Error(`signIn Alice (email confirm provavelmente ativo): ${r.error.message}`);
    }
    if (!b.data.session) {
      const r = await bobClient.auth.signInWithPassword({ email: bobEmail, password });
      if (r.error) throw new Error(`signIn Bob: ${r.error.message}`);
    }

    aliceUserId = (await aliceClient.auth.getUser()).data.user!.id;
    bobUserId = (await bobClient.auth.getUser()).data.user!.id;

    // Bob cria um budget próprio.
    const ins = await bobClient.from("category_budgets").insert({
      user_id: bobUserId,
      category_label: "Test:Bob",
      monthly_limit: 100,
      scope: "parent",
    }).select("id").single();
    if (ins.error) throw new Error(`insert Bob: ${ins.error.message}`);
    bobBudgetId = ins.data.id as string;
  }, 30_000);

  afterAll(async () => {
    // Best-effort teardown via account-delete (precisa do JWT do próprio user).
    for (const [client, email] of [[aliceClient, aliceEmail], [bobClient, bobEmail]] as const) {
      try {
        const session = (await client.auth.getSession()).data.session;
        if (!session) continue;
        await fetch(`${URL}/functions/v1/account-delete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: KEY!,
          },
          body: JSON.stringify({ confirm_email: email }),
        });
      } catch { /* limpeza best-effort; LGPD job recolhe */ }
    }
  }, 30_000);

  it("Alice NÃO consegue SELECT no budget de Bob (RLS isola)", async () => {
    const { data, error } = await aliceClient
      .from("category_budgets")
      .select("*")
      .eq("id", bobBudgetId);
    // Esperado: sem erro, mas array vazio (RLS owner-scope).
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("Alice NÃO consegue UPDATE no budget de Bob", async () => {
    const { data, error } = await aliceClient
      .from("category_budgets")
      .update({ monthly_limit: 99999 })
      .eq("id", bobBudgetId)
      .select();
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0); // RLS impede; nenhuma linha tocada
  });

  it("Alice NÃO consegue DELETE no budget de Bob", async () => {
    const { data, error } = await aliceClient
      .from("category_budgets")
      .delete()
      .eq("id", bobBudgetId)
      .select();
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("Bob ainda enxerga o próprio budget intacto", async () => {
    const { data, error } = await bobClient
      .from("category_budgets")
      .select("monthly_limit")
      .eq("id", bobBudgetId)
      .single();
    expect(error).toBeNull();
    expect(Number(data?.monthly_limit)).toBe(100);
  });

  it("Alice tentando spoofar user_id em INSERT é bloqueada", async () => {
    const { error } = await aliceClient
      .from("category_budgets")
      .insert({
        user_id: bobUserId, // tenta gravar como se fosse Bob
        category_label: "spoof",
        monthly_limit: 1,
        scope: "parent",
      });
    // RLS WITH CHECK auth.uid() = user_id → falha.
    expect(error).toBeTruthy();
  });

  it("Alice NÃO consegue chamar pluggy-delete-item passando itemId fictício", async () => {
    const session = (await aliceClient.auth.getSession()).data.session!;
    const r = await fetch(`${URL}/functions/v1/pluggy-delete-item`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: KEY!,
      },
      body: JSON.stringify({ itemId: "not-mine-fake-uuid" }),
    });
    // 404 porque RLS não devolve linha — nunca 500/200.
    expect([401, 403, 404]).toContain(r.status);
  }, 15_000);
});