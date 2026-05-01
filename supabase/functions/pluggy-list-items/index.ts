import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pluggyFetch } from "../_shared/pluggy.ts";
import { errorResponse } from "../_shared/errors.ts";

// Lista os items conectados do usuário autenticado.
// O user é derivado do JWT — NUNCA aceitamos clientUserId do body/query.
// RLS na tabela garante isolamento por usuário.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse("unauthorized");
    }
    // Cliente com auth do usuário — RLS aplica filtro automático.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return errorResponse("unauthorized", {
        logContext: "list-items: JWT inválido",
        logDetails: userError?.message,
      });
    }

    const { data: rows, error: dbError } = await supabase
      .from("pluggy_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (dbError) {
      return errorResponse("internal_error", {
        logContext: "list-items db error",
        logDetails: dbError.message,
      });
    }

    // Refresh leve: para cada item, buscar status atual na Pluggy.
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
              status_detail: it.statusDetail ?? row.status_detail ?? null,
              last_synced_at: it.lastUpdatedAt ?? it.updatedAt ?? row.last_synced_at,
            })
            .eq("pluggy_item_id", row.pluggy_item_id);
          return {
            ...row,
            status: it.status ?? row.status,
            execution_status: it.executionStatus ?? row.execution_status,
            status_detail: it.statusDetail ?? row.status_detail ?? null,
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
    return errorResponse("internal_error", {
      logContext: "pluggy-list-items exception",
      logDetails: err instanceof Error ? err.message : err,
    });
  }
});
