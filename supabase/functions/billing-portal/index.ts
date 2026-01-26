// supabase/functions/billing-portal/index.ts
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Used for Stripe return_url
const PUBLIC_SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") ?? "http://localhost:5173").replace(/\/$/, "");

// Allowed front-end origins for CORS
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  ["http://localhost:5173", "https://auditdapps.com", "https://www.auditdapps.com"].join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

// Stripe (Edge Functions run on Deno, but Stripe npm works fine this way)
const stripe = new Stripe(STRIPE_SECRET_KEY, {});


// Service role client (server-side only)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function buildCorsHeaders(origin: string | null): HeadersInit {
  const o = (origin ?? "").trim();
  const allow = ALLOWED_ORIGINS.includes(o) ? o : (ALLOWED_ORIGINS[0] ?? "*");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

function json(status: number, body: Record<string, JsonValue>, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const v = authHeader.trim();
  if (!v) return null;
  const m = v.match(/^Bearer\s+(.+)$/i);
  return (m?.[1] ?? v).trim() || null;
}

Deno.serve(async (req: Request) => {
  const headers = buildCorsHeaders(req.headers.get("origin"));

  // Preflight
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers });

  if (req.method !== "POST") {
    return json(405, { error: "Method Not Allowed" }, headers);
  }

  try {
    const token = getBearerToken(req.headers.get("authorization"));
    if (!token) return json(401, { error: "Missing authorization token" }, headers);

    // Identify user from JWT
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error("[billing-portal] auth.getUser error:", userErr);
      return json(401, { error: "Unauthorized" }, headers);
    }

    const user = userData.user;

    // Load profile (must include stripe_customer_id column)
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profErr) {
      console.error("[billing-portal] load profile error:", profErr);
      return json(500, { error: "Failed to load profile" }, headers);
    }

    let customerId = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null;

    // Ensure a Stripe customer exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (user.email ?? (profile as { email?: string | null } | null)?.email ?? undefined) || undefined,
        metadata: { user_id: user.id },
      });

      customerId = customer.id;

      const { error: upErr } = await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);

      if (upErr) {
        console.error("[billing-portal] failed to persist stripe_customer_id:", upErr);
        // fail-open: still allow portal
      }
    }

    // Create portal session
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${PUBLIC_SITE_URL}/billing`,
    });

    if (!portal?.url) {
      console.error("[billing-portal] portal session created but no url returned");
      return json(500, { error: "Stripe did not return a portal URL" }, headers);
    }

    return json(200, { url: portal.url }, headers);
  } catch (e) {
    console.error("[billing-portal] unhandled error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return json(500, { error: msg }, headers);
  }
});
