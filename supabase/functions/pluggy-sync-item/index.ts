import { corsHeaders } from "../_shared/cors.ts";
import { pluggyFetch } from "../_shared/pluggy.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Dispara sincronização (refresh) de um item Pluggy.
// Verifica que o item pertence ao usuário autenticado antes de chamar Pluggy.

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as { itemId?: string };
    if (!body.itemId) {
      return new Response(JSON.stringify({ error: "itemId_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica posse: RLS retorna 0 linhas se o item não for do usuário.
    const { data: ownItem, error: ownErr } = await supabase
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

    const res = await pluggyFetch(`/items/${encodeURIComponent(body.itemId)}`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    const data = await res.json();

    if (!res.ok) {
      // 409 CLIENT_IS_UPDATING_BEFORE_ALLOWED_FREQUENCY: Pluggy só permite refresh
      // a cada 1h. Não é erro real — só precisamos seguir para o sync de dados.
      if (res.status === 409) {
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "rate_limited", details: data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.error("pluggy-sync-item error", res.status, data);
      return new Response(
        JSON.stringify({ error: "pluggy_sync_failed", status: res.status, details: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error("pluggy-sync-item exception", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});