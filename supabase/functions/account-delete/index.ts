import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { pluggyFetch } from "../_shared/pluggy.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Direito ao esquecimento — LGPD Art. 18, VI.
// Fluxo:
// 1. Valida JWT.
// 2. Exige body { confirm_email: <email> } igualando o email do usuário (dupla confirmação).
// 3. Para cada pluggy_item, chama DELETE /items/{id} na Pluggy (revoga consentimento upstream).
// 4. Apaga em cascata todas as tabelas do usuário usando service role.
// 5. Apaga o usuário em auth.users via admin API.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "DELETE") {
    return errorResponse("method_not_allowed");
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse("unauthorized");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return errorResponse("unauthorized", {
        logContext: "account-delete: JWT inválido",
        logDetails: userError?.message,
      });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? "";

    let body: { confirm_email?: string } = {};
    try { body = await req.json(); } catch { body = {}; }

    if (!body.confirm_email || body.confirm_email.trim().toLowerCase() !== userEmail.toLowerCase()) {
      return errorResponse("bad_request", {
        message: "Confirme digitando o e-mail da sua conta.",
        logContext: "account-delete: confirm_email mismatch",
      });
    }

    // Cliente admin para apagar e bypassar RLS.
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Lista items para revogar upstream.
    const { data: items } = await admin
      .from("pluggy_items")
      .select("pluggy_item_id")
      .eq("user_id", userId);

    const revokeResults: Array<{ itemId: string; ok: boolean }> = [];
    for (const item of items ?? []) {
      try {
        const res = await pluggyFetch(`/items/${item.pluggy_item_id}`, { method: "DELETE" });
        revokeResults.push({ itemId: item.pluggy_item_id, ok: res.ok });
        if (!res.ok) {
          console.error(`[account-delete] revoke pluggy item failed`, { itemId: item.pluggy_item_id, status: res.status });
        }
      } catch (e) {
        revokeResults.push({ itemId: item.pluggy_item_id, ok: false });
        console.error(`[account-delete] revoke pluggy item exception`, e);
      }
    }

    // 2. Registra evento ANTES da deleção (depois some junto).
    await admin.from("audit_log").insert({
      user_id: userId,
      event_type: "account.deleted",
      event_details: {
        revoked_pluggy_items: revokeResults,
      },
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    });

    // 3. Cascade delete (ordem importa só por consistência visual nos logs).
    const tables = [
      "pluggy_transactions",
      "pluggy_bills",
      "pluggy_investments",
      "pluggy_accounts",
      "pluggy_items",
      "category_budgets",
      "total_budget_settings",
      "card_cycle_settings",
      "audit_log",
      "profiles",
    ];
    for (const table of tables) {
      const column = table === "profiles" ? "id" : "user_id";
      const { error } = await admin.from(table).delete().eq(column, userId);
      if (error) {
        console.error(`[account-delete] delete ${table} failed`, error.message);
      }
    }

    // 4. Apaga em auth.users.
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      return errorResponse("internal_error", {
        logContext: "account-delete: auth.admin.deleteUser failed",
        logDetails: deleteUserError.message,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return errorResponse("internal_error", {
      logContext: "account-delete exception",
      logDetails: err instanceof Error ? err.message : err,
    });
  }
});