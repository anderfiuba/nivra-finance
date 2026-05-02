import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, cors);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "unauthorized" }, 401, cors);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401, cors);

    const body = await req.json().catch(() => ({}));
    const priceId = String(body.priceId ?? "");
    const environment = body.environment === "live" ? "live" : "sandbox" as StripeEnv;
    const returnUrl = String(body.returnUrl ?? "");

    if (!/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      return jsonResponse({ error: "invalid_price_id" }, 400, cors);
    }
    if (!returnUrl || !/^https?:\/\//i.test(returnUrl)) {
      return jsonResponse({ error: "invalid_return_url" }, 400, cors);
    }

    const stripe = createStripeClient(environment);
    const prices = await stripe.prices.list({ lookup_keys: [priceId] });
    if (!prices.data.length) return jsonResponse({ error: "price_not_found" }, 404, cors);
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      customer_email: user.email ?? undefined,
      metadata: { userId: user.id },
      ...(isRecurring && { subscription_data: { metadata: { userId: user.id } } }),
    });

    return jsonResponse({ clientSecret: session.client_secret }, 200, cors);
  } catch (err) {
    console.error("create-checkout error:", err);
    return jsonResponse({ error: "checkout_failed" }, 500, cors);
  }
});