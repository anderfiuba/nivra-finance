import { corsHeaders } from "../_shared/cors.ts";
import { pluggyFetch } from "../_shared/pluggy.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Recebe { itemId } do frontend após o usuário concluir o Pluggy Connect.
// O user é derivado do JWT (NUNCA do body) e gravado em user_id +
// client_user_id. RLS impede gravar em nome de outro usuário.

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
    const userId = userData.user.id;

    const body = (await req.json()) as { itemId?: string };
    if (!body.itemId) {
      return new Response(JSON.stringify({ error: "itemId_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca dados do item na Pluggy
    const itemRes = await pluggyFetch(`/items/${encodeURIComponent(body.itemId)}`, {
      method: "GET",
    });
    const itemData = await itemRes.json();
    if (!itemRes.ok) {
      console.error("pluggy-register-item fetch error", itemRes.status, itemData);
      return new Response(
        JSON.stringify({ error: "pluggy_item_fetch_failed", details: itemData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const row = {
      user_id: userId,
      client_user_id: userId,
      pluggy_item_id: itemData.id,
      connector_id: itemData.connector?.id ?? null,
      connector_name: itemData.connector?.name ?? "Banco",
      connector_image_url: itemData.connector?.imageUrl ?? null,
      connector_primary_color: itemData.connector?.primaryColor ?? null,
      status: itemData.status ?? null,
      execution_status: itemData.executionStatus ?? null,
      last_synced_at: itemData.lastUpdatedAt ?? itemData.updatedAt ?? null,
    };

    const { error: upsertError } = await supabase
      .from("pluggy_items")
      .upsert(row, { onConflict: "pluggy_item_id" });

    if (upsertError) {
      console.error("pluggy-register-item upsert error", upsertError);
      return new Response(
        JSON.stringify({ error: "db_upsert_failed", details: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true, item: row }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error("pluggy-register-item exception", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});