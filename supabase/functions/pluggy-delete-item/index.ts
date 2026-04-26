import { corsHeaders } from "../_shared/cors.ts";
import { pluggyFetch } from "../_shared/pluggy.ts";
import { errorResponse } from "../_shared/errors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Remove um item Pluggy do usuário:
// 1. Verifica autenticação JWT.
// 2. Confirma posse do item (RLS).
// 3. Chama DELETE /items/{id} na Pluggy (revoga consentimento).
// 4. Limpa do nosso banco: transactions, bills, accounts e o próprio item.
//    `category_budgets` é preferência do usuário e NÃO é apagado.

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

    // Cliente com o JWT do usuário (para checar posse via RLS).
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return errorResponse("unauthorized", {
        logContext: "delete-item: JWT inválido",
        logDetails: userError?.message,
      });
    }
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as { itemId?: string };
    const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
    if (!itemId) {
      return errorResponse("bad_request", { message: "itemId é obrigatório." });
    }

    // Verifica posse: RLS bloqueia se o item não for do usuário.
    const { data: ownItem, error: ownErr } = await supabaseUser
      .from("pluggy_items")
      .select("pluggy_item_id")
      .eq("pluggy_item_id", itemId)
      .maybeSingle();
    if (ownErr || !ownItem) {
      return errorResponse("not_found", {
        logContext: "delete-item: item não pertence ao usuário",
        logDetails: { userId, itemId, err: ownErr?.message },
      });
    }

    // 1) Apaga na Pluggy. 404/410 = já removido lá; tratamos como sucesso.
    const res = await pluggyFetch(`/items/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const details = await res.text();
      return errorResponse("upstream_error", {
        logContext: "delete-item: pluggy DELETE failed",
        logDetails: { status: res.status, body: details },
      });
    }

    // 2) Limpa nosso banco. Service role + filtro user_id (defense in depth).
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const tables = [
      "pluggy_transactions",
      "pluggy_bills",
      "pluggy_accounts",
      "pluggy_items",
    ] as const;
    const errors: { table: string; message: string }[] = [];
    for (const table of tables) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq("pluggy_item_id", itemId)
        .eq("user_id", userId);
      if (error) errors.push({ table, message: error.message });
    }
    if (errors.length > 0) {
      return errorResponse("internal_error", {
        logContext: "delete-item: db cleanup errors",
        logDetails: errors,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return errorResponse("internal_error", {
      logContext: "pluggy-delete-item exception",
      logDetails: err instanceof Error ? err.message : err,
    });
  }
});