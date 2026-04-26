import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Exporta TODOS os dados pessoais do usuário autenticado em JSON único.
// Direito de portabilidade — LGPD Art. 18, V.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return errorResponse("method_not_allowed");
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse("unauthorized");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return errorResponse("unauthorized", {
        logContext: "account-export: JWT inválido",
        logDetails: userError?.message,
      });
    }
    const userId = userData.user.id;

    // Coleta tudo (RLS garante que só vê o próprio).
    const [
      profile,
      pluggyItems,
      pluggyAccounts,
      pluggyTransactions,
      pluggyBills,
      categoryBudgets,
      totalBudget,
      cardCycle,
      auditLog,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("pluggy_items").select("*").eq("user_id", userId),
      supabase.from("pluggy_accounts").select("*").eq("user_id", userId),
      supabase.from("pluggy_transactions").select("*").eq("user_id", userId),
      supabase.from("pluggy_bills").select("*").eq("user_id", userId),
      supabase.from("category_budgets").select("*").eq("user_id", userId),
      supabase.from("total_budget_settings").select("*").eq("user_id", userId),
      supabase.from("card_cycle_settings").select("*").eq("user_id", userId),
      supabase.from("audit_log").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1000),
    ]);

    const exportPayload = {
      exported_at: new Date().toISOString(),
      user: {
        id: userId,
        email: userData.user.email,
        created_at: userData.user.created_at,
      },
      profile: profile.data ?? null,
      pluggy_items: pluggyItems.data ?? [],
      pluggy_accounts: pluggyAccounts.data ?? [],
      pluggy_transactions: pluggyTransactions.data ?? [],
      pluggy_bills: pluggyBills.data ?? [],
      category_budgets: categoryBudgets.data ?? [],
      total_budget_settings: totalBudget.data ?? [],
      card_cycle_settings: cardCycle.data ?? [],
      audit_log: auditLog.data ?? [],
    };

    // Registra evento de exportação na trilha (best-effort).
    await supabase.from("audit_log").insert({
      user_id: userId,
      event_type: "account.exported",
      event_details: { record_counts: {
        items: exportPayload.pluggy_items.length,
        accounts: exportPayload.pluggy_accounts.length,
        transactions: exportPayload.pluggy_transactions.length,
      } },
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    });

    const filename = `nivra-export-${userId}-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return errorResponse("internal_error", {
      logContext: "account-export exception",
      logDetails: err instanceof Error ? err.message : err,
    });
  }
});