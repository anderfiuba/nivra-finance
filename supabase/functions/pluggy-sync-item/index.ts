import { corsHeaders } from "@supabase/supabase-js/cors";
import { pluggyFetch } from "../_shared/pluggy.ts";

// Dispara uma sincronização (refresh) de um item Pluggy específico.
// Pluggy expõe POST /items/{id} para forçar atualização dos dados.

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
    const body = (await req.json()) as { itemId?: string };
    if (!body.itemId) {
      return new Response(JSON.stringify({ error: "itemId_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await pluggyFetch(`/items/${encodeURIComponent(body.itemId)}`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    const data = await res.json();

    if (!res.ok) {
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