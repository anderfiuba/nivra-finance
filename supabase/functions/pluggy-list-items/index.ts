import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pluggyFetch } from "../_shared/pluggy.ts";

// Lista os items conectados deste cliente (lendo do banco) e
// atualiza status/last_synced_at consultando a Pluggy item-a-item.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const clientUserId = url.searchParams.get("clientUserId");
    if (!clientUserId) {
      return new Response(JSON.stringify({ error: "clientUserId_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rows, error: dbError } = await supabase
      .from("pluggy_items")
      .select("*")
      .eq("client_user_id", clientUserId)
      .order("created_at", { ascending: false });

    if (dbError) {
      console.error("pluggy-list-items db error", dbError);
      return new Response(JSON.stringify({ error: "db_error", details: dbError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Refresh leve: para cada item, buscar status atual na Pluggy.
    // Em produção isto seria um job; por ora fazemos inline (poucos items).
    const results = await Promise.all(
      (rows ?? []).map(async (row) => {
        try {
          const r = await pluggyFetch(`/items/${encodeURIComponent(row.pluggy_item_id)}`, {
            method: "GET",
          });
          if (!r.ok) {
            await r.text();
            return row;
          }
          const it = await r.json();
          // Atualiza no banco em background (sem await crítico)
          await supabase
            .from("pluggy_items")
            .update({
              status: it.status ?? row.status,
              execution_status: it.executionStatus ?? row.execution_status,
              last_synced_at: it.lastUpdatedAt ?? it.updatedAt ?? row.last_synced_at,
            })
            .eq("pluggy_item_id", row.pluggy_item_id);
          return {
            ...row,
            status: it.status ?? row.status,
            execution_status: it.executionStatus ?? row.execution_status,
            last_synced_at: it.lastUpdatedAt ?? it.updatedAt ?? row.last_synced_at,
          };
        } catch (e) {
          console.warn("refresh item failed", row.pluggy_item_id, e);
          return row;
        }
      }),
    );

    return new Response(JSON.stringify({ items: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error("pluggy-list-items exception", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
