// supabase/functions/create-checkout-session/index.ts
import Stripe from "stripe";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY env var");
}

const stripe = new Stripe(stripeSecretKey, {});

// You can override this in Supabase env as PUBLIC_SITE_URL=https://auditdapps.com
const DEFAULT_SITE_URL =
  Deno.env.get("PUBLIC_SITE_URL") ?? "http://localhost:5173";

// Allowed front-end origins for CORS
// You can also move this to ALLOWED_ORIGINS env if you like.
const ALLOWED_ORIGINS = (
  Deno.env.get("ALLOWED_ORIGINS") ??
  [
    "http://localhost:5173",
    "https://auditdapps.com",
    "https://www.auditdapps.com",
  ].join(",")
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function buildCorsHeaders(origin: string | null): Record<string, string> {
  const normalizedOrigin = origin ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(normalizedOrigin)
    ? normalizedOrigin
    : ALLOWED_ORIGINS[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { priceId, userId, email, successUrl, cancelUrl } = await req.json();

    if (!priceId || !userId || !email) {
      return new Response(
        JSON.stringify({ error: "Missing priceId, userId or email" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // If frontend passes successUrl/cancelUrl, we use those.
    // Otherwise we fall back to the site URL (dev or prod based on env).
    const baseUrl = DEFAULT_SITE_URL.replace(/\/$/, "");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url:
        successUrl ??
        `${baseUrl}/auth/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl ?? `${baseUrl}/auth/payment`,
      metadata: { user_id: userId },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("[create-checkout-session] error:", err);

    const message =
      err instanceof Error ? err.message : "Unable to create checkout session";

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
