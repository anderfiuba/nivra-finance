import { corsHeaders } from "../_shared/cors.ts";
import { pluggyFetch } from "../_shared/pluggy.ts";
import { errorResponse } from "../_shared/errors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Reconcilia itens criados na Pluggy mas ausentes no nosso banco.
//
// Necessário porque, em mobile, o redirect OAuth do banco abre uma nova
// instância da SPA — então o callback in-memory `onSuccess` do PluggyConnect
// não dispara e o item nunca é registrado via /pluggy-register-item.
//
// Este endpoint:
//  1. Lista itens da Pluggy filtrados por clientUserId = user.id (JWT).
//  2. Compara com pluggy_items do user no nosso banco.
//  3. Faz upsert dos ausentes — mesmo shape do pluggy-register-item.
//
// Idempotente (upsert por pluggy_item_id). RLS garante isolamento.

interface PluggyItem {
  id: string;
  status?: string;
  executionStatus?: string;
  lastUpdatedAt?: string;
  updatedAt?: string;
  connector?: {
    id?: number;
    name?: string;
    imageUrl?: string;
    primaryColor?: string;
  };
}

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
        logContext: "reconcile-items: JWT inválido",
        logDetails: userError?.message,
      });
    }
    const userId = userData.user.id;

    // 1. Lista itens da Pluggy para este clientUserId.
    const listRes = await pluggyFetch(
      `/items?clientUserId=${encodeURIComponent(userId)}`,
      { method: "GET" },
    );
    const listData = await listRes.json();
    if (!listRes.ok) {
      return errorResponse("upstream_error", {
        logContext: "reconcile-items: pluggy /items failed",
        logDetails: { status: listRes.status, body: listData },
      });
    }

    const pluggyItems: PluggyItem[] = Array.isArray(listData?.results)
      ? listData.results
      : Array.isArray(listData)
        ? listData
        : [];

    if (pluggyItems.length === 0) {
      return new Response(JSON.stringify({ reconciled: [], total: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Quais já temos no banco?
    const { data: existingRows, error: existingErr } = await supabase
      .from("pluggy_items")
      .select("pluggy_item_id");
    if (existingErr) {
      return errorResponse("internal_error", {
        logContext: "reconcile-items db select failed",
        logDetails: existingErr.message,
      });
    }
    const existingIds = new Set((existingRows ?? []).map((r) => r.pluggy_item_id));

    const missing = pluggyItems.filter((it) => it.id && !existingIds.has(it.id));

    if (missing.length === 0) {
      return new Response(JSON.stringify({ reconciled: [], total: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Upsert dos ausentes.
    const rows = missing.map((it) => ({
      user_id: userId,
      client_user_id: userId,
      pluggy_item_id: it.id,
      connector_id: it.connector?.id ?? null,
      connector_name: it.connector?.name ?? "Banco",
      connector_image_url: it.connector?.imageUrl ?? null,
      connector_primary_color: it.connector?.primaryColor ?? null,
      status: it.status ?? null,
      execution_status: it.executionStatus ?? null,
      last_synced_at: it.lastUpdatedAt ?? it.updatedAt ?? null,
    }));

    const { error: upsertError } = await supabase
      .from("pluggy_items")
      .upsert(rows, { onConflict: "pluggy_item_id" });

    if (upsertError) {
      return errorResponse("internal_error", {
        logContext: "reconcile-items db upsert failed",
        logDetails: upsertError.message,
      });
    }

    return new Response(
      JSON.stringify({
        reconciled: rows.map((r) => r.pluggy_item_id),
        total: rows.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return errorResponse("internal_error", {
      logContext: "pluggy-reconcile-items exception",
      logDetails: err instanceof Error ? err.message : err,
    });
  }
});