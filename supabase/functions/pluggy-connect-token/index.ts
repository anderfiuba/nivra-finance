import { corsHeaders } from "../_shared/cors.ts";
import { pluggyFetch } from "../_shared/pluggy.ts";
import { errorResponse } from "../_shared/errors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Cria um connect_token efêmero da Pluggy.
// Requer JWT válido — o clientUserId é SEMPRE derivado do user autenticado,
// nunca aceito do body (privacidade). Body opcional:
//   { itemId?: string }  -> para reautenticar uma conexão existente
//   { oauthRedirectUri?: string } -> retorno do OAuth/Open Finance em mobile
//   { openFinanceOnly?: boolean } -> devolve IDs de conectores Open Finance

interface ConnectTokenBody {
  itemId?: string;
  oauthRedirectUri?: string;
  openFinanceOnly?: boolean;
}

interface PluggyConnector {
  id: number;
  type?: string;
  isOpenFinance?: boolean;
}

async function listOpenFinanceConnectorIds(): Promise<number[]> {
  const connectorIds: number[] = [];
  const supportedTypes = new Set(["PERSONAL_BANK", "BUSINESS_BANK"]);
  let page = 1;
  let totalPages = 1;

  do {
    const res = await pluggyFetch(`/connectors?isOpenFinance=true&pageSize=500&page=${page}`, {
      method: "GET",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Pluggy /connectors falhou [${res.status}]: ${JSON.stringify(data)}`);
    }

    const results = Array.isArray(data?.results) ? (data.results as PluggyConnector[]) : [];
    for (const connector of results) {
      if (typeof connector.id === "number" && (!connector.type || supportedTypes.has(connector.type))) {
        connectorIds.push(connector.id);
      }
    }

    totalPages = typeof data?.totalPages === "number" ? data.totalPages : 1;
    page += 1;
  } while (page <= totalPages);

  return connectorIds;
}

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

    let body: ConnectTokenBody = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const payload: Record<string, unknown> = {};
    if (body.itemId && typeof body.itemId === "string") payload.itemId = body.itemId;
    // Sempre usa o user.id autenticado como clientUserId na Pluggy.
    payload.options = {
      clientUserId: userData.user.id,
      ...(body.oauthRedirectUri && typeof body.oauthRedirectUri === "string"
        ? { oauthRedirectUri: body.oauthRedirectUri }
        : {}),
    };

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

    const openFinanceConnectorIds = body.openFinanceOnly === true ? await listOpenFinanceConnectorIds() : undefined;

    return new Response(JSON.stringify({ accessToken: data.accessToken, openFinanceConnectorIds }), {
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