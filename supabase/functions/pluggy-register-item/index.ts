import { corsHeaders } from "../_shared/cors.ts";
import { pluggyFetch } from "../_shared/pluggy.ts";
import { errorResponse } from "../_shared/errors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Recebe { itemId } do frontend após o usuário concluir o Pluggy Connect.
// O user é derivado do JWT (NUNCA do body) e gravado em user_id +
// client_user_id. RLS impede gravar em nome de outro usuário.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("method_not_allowed");
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse("unauthorized");
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return errorResponse("unauthorized", {
        logContext: "register-item: JWT inválido",
        logDetails: userError?.message,
      });
    }
    const userId = userData.user.id;

    const body = (await req.json()) as { itemId?: string };
    if (!body.itemId) {
      return errorResponse("bad_request", { message: "itemId é obrigatório." });
    }

    // Busca dados do item na Pluggy
    const itemRes = await pluggyFetch(`/items/${encodeURIComponent(body.itemId)}`, {
      method: "GET",
    });
    const itemData = await itemRes.json();
    if (!itemRes.ok) {
      return errorResponse("upstream_error", {
        logContext: "register-item: pluggy fetch failed",
        logDetails: { status: itemRes.status, body: itemData },
      });
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
      return errorResponse("internal_error", {
        logContext: "register-item db upsert failed",
        logDetails: upsertError.message,
      });
    }

    return new Response(JSON.stringify({ ok: true, item: row }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return errorResponse("internal_error", {
      logContext: "pluggy-register-item exception",
      logDetails: err instanceof Error ? err.message : err,
    });
  }
});