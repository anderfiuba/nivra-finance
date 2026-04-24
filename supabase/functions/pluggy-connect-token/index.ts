import { corsHeaders } from "@supabase/supabase-js/cors";
import { pluggyFetch } from "../_shared/pluggy.ts";

// Cria um connect_token efêmero da Pluggy.
// Esse token é o que o frontend usa para abrir o Pluggy Connect Widget
// (com QR no desktop ou redirect no mobile). Nunca expomos clientId/secret.
//
// Body opcional:
//   { itemId?: string }  -> para reautenticar uma conexão existente
//   { clientUserId?: string } -> para vincular ao usuário interno

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let body: { itemId?: string; clientUserId?: string } = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const payload: Record<string, unknown> = {};
    if (body.itemId) payload.itemId = body.itemId;
    if (body.clientUserId) {
      payload.options = { clientUserId: body.clientUserId };
    }

    const res = await pluggyFetch("/connect_token", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("pluggy-connect-token error", res.status, data);
      return new Response(
        JSON.stringify({ error: "pluggy_connect_token_failed", status: res.status, details: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ accessToken: data.accessToken }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error("pluggy-connect-token exception", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});