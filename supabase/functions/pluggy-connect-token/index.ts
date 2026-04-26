import { corsHeaders } from "../_shared/cors.ts";
import { pluggyFetch } from "../_shared/pluggy.ts";
import { errorResponse } from "../_shared/errors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Cria um connect_token efêmero da Pluggy.
// Requer JWT válido — o clientUserId é SEMPRE derivado do user autenticado,
// nunca aceito do body (privacidade). Body opcional:
//   { itemId?: string }  -> para reautenticar uma conexão existente

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
        logContext: "connect-token: JWT inválido",
        logDetails: userError?.message,
      });
    }

    let body: { itemId?: string } = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const payload: Record<string, unknown> = {};
    if (body.itemId) payload.itemId = body.itemId;
    // Sempre usa o user.id autenticado como clientUserId na Pluggy.
    payload.options = { clientUserId: userData.user.id };

    const res = await pluggyFetch("/connect_token", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return errorResponse("upstream_error", {
        logContext: "connect-token: pluggy /connect_token failed",
        logDetails: { status: res.status, body: data },
      });
    }

    return new Response(JSON.stringify({ accessToken: data.accessToken }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return errorResponse("internal_error", {
      logContext: "pluggy-connect-token exception",
      logDetails: err instanceof Error ? err.message : err,
    });
  }
});