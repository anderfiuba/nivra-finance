import { corsHeaders } from "../_shared/cors.ts";
import { pluggyFetch } from "../_shared/pluggy.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Sincroniza accounts + transactions de um item Pluggy para o nosso banco.
// Segurança:
//   1. Exige JWT (verify_jwt=true).
//   2. Confirma posse do item via RLS antes de qualquer fetch na Pluggy.
//   3. Faz upsert usando service role mas SEMPRE marcando user_id = auth.uid().
//      Assim mesmo com service role bypass, o dado fica corretamente atribuído
//      e visível apenas para o dono via RLS.

interface PluggyAccount {
  id: string;
  itemId: string;
  name: string;
  marketingName?: string | null;
  type?: string | null;
  subtype?: string | null;
  balance: number;
  currencyCode?: string | null;
  owner?: string | null;
  taxNumber?: string | null;
}

interface PluggyTransaction {
  id: string;
  accountId: string;
  description: string;
  descriptionRaw?: string | null;
  amount: number;
  currencyCode?: string | null;
  date: string;
  category?: string | null;
  categoryId?: string | null;
  paymentData?: { paymentMethod?: string | null } | null;
  type?: string | null;
}

const PAGE_SIZE = 500;

async function fetchAllTransactions(accountId: string): Promise<PluggyTransaction[]> {
  const all: PluggyTransaction[] = [];
  let page = 1;
  // Pega últimos 90 dias por padrão (Pluggy sandbox/produção)
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  while (true) {
    const url = `/transactions?accountId=${encodeURIComponent(accountId)}&from=${fromStr}&to=${toStr}&pageSize=${PAGE_SIZE}&page=${page}`;
    const res = await pluggyFetch(url, { method: "GET" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Pluggy /transactions falhou [${res.status}]: ${body}`);
    }
    const data = (await res.json()) as { results: PluggyTransaction[]; total: number; totalPages: number };
    all.push(...(data.results ?? []));
    if (page >= (data.totalPages ?? 1)) break;
    page += 1;
    if (page > 20) break; // safety
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente do usuário (RLS) — usado apenas para validar posse.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as { itemId?: string };
    if (!body.itemId) {
      return new Response(JSON.stringify({ error: "itemId_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirma posse via RLS
    const { data: ownItem, error: ownErr } = await userClient
      .from("pluggy_items")
      .select("pluggy_item_id")
      .eq("pluggy_item_id", body.itemId)
      .maybeSingle();
    if (ownErr || !ownItem) {
      return new Response(JSON.stringify({ error: "item_not_found_or_forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Atualiza status do item
    const itemRes = await pluggyFetch(`/items/${encodeURIComponent(body.itemId)}`, {
      method: "GET",
    });
    const itemData = await itemRes.json();
    if (!itemRes.ok) {
      console.error("pluggy-sync-data item fetch error", itemRes.status, itemData);
      return new Response(
        JSON.stringify({ error: "pluggy_item_fetch_failed", details: itemData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Busca accounts
    const accRes = await pluggyFetch(`/accounts?itemId=${encodeURIComponent(body.itemId)}`, {
      method: "GET",
    });
    const accJson = await accRes.json();
    if (!accRes.ok) {
      console.error("pluggy-sync-data accounts error", accRes.status, accJson);
      return new Response(
        JSON.stringify({ error: "pluggy_accounts_fetch_failed", details: accJson }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const accounts: PluggyAccount[] = accJson.results ?? [];

    // Cliente service role para upsert (bypassa RLS, mas força user_id = userId).
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Upsert accounts
    if (accounts.length > 0) {
      const accountRows = accounts.map((a) => ({
        user_id: userId,
        pluggy_account_id: a.id,
        pluggy_item_id: body.itemId!,
        name: a.name,
        marketing_name: a.marketingName ?? null,
        type: a.type ?? null,
        subtype: a.subtype ?? null,
        // Para contas de cartão de crédito (CREDIT), o balance retornado pela
        // Pluggy é o valor da fatura em aberto (positivo). Tratamos como dívida
        // (saldo negativo) para refletir corretamente no saldo consolidado.
        balance: (() => {
          const raw = typeof a.balance === "number" ? a.balance : 0;
          if ((a.type ?? "").toUpperCase() === "CREDIT") return -Math.abs(raw);
          return raw;
        })(),
        currency: a.currencyCode ?? "BRL",
        owner: a.owner ?? null,
        tax_number: a.taxNumber ?? null,
      }));
      const { error: accUpsertErr } = await adminClient
        .from("pluggy_accounts")
        .upsert(accountRows, { onConflict: "pluggy_account_id" });
      if (accUpsertErr) {
        console.error("upsert pluggy_accounts failed", accUpsertErr);
        return new Response(
          JSON.stringify({ error: "db_accounts_upsert_failed", details: accUpsertErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 3. Busca transações por conta
    let totalTx = 0;
    for (const acc of accounts) {
      const txs = await fetchAllTransactions(acc.id);
      if (txs.length === 0) continue;
      const rows = txs.map((t) => ({
        user_id: userId,
        pluggy_transaction_id: t.id,
        pluggy_account_id: t.accountId,
        pluggy_item_id: body.itemId!,
        description: t.description ?? t.descriptionRaw ?? "Sem descrição",
        // Pluggy retorna `amount` sempre positivo + `type` ("DEBIT"|"CREDIT").
        // Persistimos com sinal: positivo = entrada, negativo = saída.
        amount: (() => {
          const abs = Math.abs(Number(t.amount) || 0);
          const isDebit = (t.type ?? "").toUpperCase() === "DEBIT";
          return isDebit ? -abs : abs;
        })(),
        currency: t.currencyCode ?? "BRL",
        transaction_date: t.date,
        category: null,
        category_pluggy: t.category ?? null,
        payment_method: t.paymentData?.paymentMethod ?? null,
        type: t.type ?? null,
        raw_payload: t as unknown as Record<string, unknown>,
      }));
      // Upsert em chunks de 500
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error: txErr } = await adminClient
          .from("pluggy_transactions")
          .upsert(chunk, { onConflict: "pluggy_transaction_id" });
        if (txErr) {
          console.error("upsert pluggy_transactions failed", txErr);
          return new Response(
            JSON.stringify({ error: "db_tx_upsert_failed", details: txErr.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      totalTx += rows.length;
    }

    // 4. Atualiza status do item
    await adminClient
      .from("pluggy_items")
      .update({
        status: itemData.status ?? null,
        execution_status: itemData.executionStatus ?? null,
        last_synced_at: new Date().toISOString(),
      })
      .eq("pluggy_item_id", body.itemId)
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({ ok: true, accounts: accounts.length, transactions: totalTx }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error("pluggy-sync-data exception", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});