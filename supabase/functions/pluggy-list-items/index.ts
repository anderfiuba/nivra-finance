import { corsHeaders } from "../_shared/cors.ts";
import { pluggyFetch } from "../_shared/pluggy.ts";

// Lista os "items" (conexões bancárias) do cliente Pluggy desta aplicação.
// No futuro, filtrar por clientUserId quando tivermos auth de usuário final.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const clientUserId = url.searchParams.get("clientUserId");
    const path = clientUserId
      ? `/items?clientUserId=${encodeURIComponent(clientUserId)}`
      : "/items";

    const res = await pluggyFetch(path, { method: "GET" });
    const data = await res.json();

    if (!res.ok) {
      console.error("pluggy-list-items error", res.status, data);
      return new Response(
        JSON.stringify({ error: "pluggy_list_items_failed", status: res.status, details: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(data), {
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