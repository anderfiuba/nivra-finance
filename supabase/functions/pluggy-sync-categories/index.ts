import { corsHeaders } from "../_shared/cors.ts";
import { pluggyFetch } from "../_shared/pluggy.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Sincroniza o catálogo global de categorias da Pluggy (/categories).
// Catálogo é universal — não está atrelado a um usuário. Mas a função exige
// JWT mesmo assim para evitar abuso.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let page = 1;
    type Cat = {
      id: string;
      description: string;
      descriptionTranslated?: string | null;
      parentId?: string | null;
      parentDescription?: string | null;
    };
    const all: Cat[] = [];
    while (true) {
      const res = await pluggyFetch(`/categories?pageSize=500&page=${page}`, { method: "GET" });
      if (!res.ok) {
        const body = await res.text();
        return new Response(
          JSON.stringify({ error: "pluggy_categories_failed", status: res.status, details: body }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const data = await res.json() as { results?: Cat[]; totalPages?: number };
      all.push(...(data.results ?? []));
      if (page >= (data.totalPages ?? 1)) break;
      page += 1;
      if (page > 10) break;
    }

    if (all.length > 0) {
      const rows = all.map((c) => ({
        id: c.id,
        description: c.description,
        description_translated: c.descriptionTranslated ?? null,
        parent_id: c.parentId ?? null,
        parent_description: c.parentDescription ?? null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await adminClient
        .from("pluggy_categories")
        .upsert(rows, { onConflict: "id" });
      if (error) {
        return new Response(
          JSON.stringify({ error: "db_upsert_failed", details: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify({ ok: true, count: all.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});