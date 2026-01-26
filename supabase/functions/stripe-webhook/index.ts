// supabase/functions/stripe-webhook/index.ts
import Stripe from "https://esm.sh/stripe@14?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Stripe or Supabase env vars");
}
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20"
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
function normalizePeriod(p) {
  if (!p) return null;
  const v = p.toLowerCase().trim();
  if (v === "weekly") return "weekly";
  if (v === "monthly") return "monthly";
  if (v === "annual" || v === "yearly") return "annual"; // accept yearly from metadata just in case
  return null;
}
function normalizeTier(t) {
  if (!t) return "premium";
  return t.toLowerCase().trim() === "free" ? "free" : "premium";
}
async function updateProfileForActivePremium(args) {
  const { userId, premiumExpiresAt, planPeriod, planTier, stripePriceId, stripeCustomerId } = args;
  const update = {
    is_premium: true,
    premium_expires_at: premiumExpiresAt,
    plan_tier: planTier,
    plan_period: planPeriod,
    stripe_price_id: stripePriceId
  };
  // only set if present
  if (stripeCustomerId) update.stripe_customer_id = stripeCustomerId;
  const { error } = await supabase.from("profiles").update(update).eq("id", userId);
  if (error) throw error;
}
async function updateProfileForFree(userId) {
  const { error } = await supabase.from("profiles").update({
    is_premium: false,
    premium_expires_at: null,
    plan_tier: "free",
    plan_period: null,
    stripe_price_id: null
  }).eq("id", userId);
  if (error) throw error;
}
Deno.serve(async (req)=>{
  if (req.method !== "POST") return new Response("Method Not Allowed", {
    status: 405
  });
  const sig = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, STRIPE_WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch (err) {
    console.error("[stripe-webhook] signature error:", err);
    return new Response("Invalid signature", {
      status: 400
    });
  }
  try {
    // 1) Initial checkout success
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      if (!userId) {
        console.warn("[stripe-webhook] checkout.session.completed missing metadata.user_id");
        return new Response(JSON.stringify({
          received: true
        }), {
          status: 200
        });
      }
      const planPeriod = normalizePeriod(session.metadata?.plan_period);
      const planTier = normalizeTier(session.metadata?.plan_tier);
      const stripePriceId = session.metadata?.stripe_price_id ?? null;
      let premiumExpiresAt = null;
      if (session.mode === "subscription" && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        premiumExpiresAt = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        await updateProfileForActivePremium({
          userId,
          premiumExpiresAt,
          planPeriod,
          planTier,
          stripePriceId,
          stripeCustomerId: session.customer ?? sub.customer
        });
        console.log("[stripe-webhook] premium activated:", {
          userId,
          planPeriod,
          stripePriceId
        });
      }
      return new Response(JSON.stringify({
        received: true
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // 2) Plan changes / renewals / period_end updates
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      // We rely on metadata.user_id if you set it, OR we can map customer -> profile
      const userIdFromMeta = sub.metadata?.user_id ?? null;
      let userId = userIdFromMeta;
      // If user_id not on subscription metadata, fall back to lookup by stripe_customer_id
      if (!userId) {
        const customerId = sub.customer;
        const { data, error } = await supabase.from("profiles").select("id").eq("stripe_customer_id", customerId).single();
        if (!error && data?.id) userId = data.id;
      }
      if (!userId) {
        console.warn("[stripe-webhook] subscription.updated could not resolve userId");
        return new Response(JSON.stringify({
          received: true
        }), {
          status: 200
        });
      }
      const premiumExpiresAt = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
      // If you use a single price per period, pull it from subscription items
      const stripePriceId = sub.items.data[0]?.price?.id ?? null;
      // If you also store plan_period in subscription metadata (recommended), use it.
      // Otherwise, keep the previously saved plan_period (don’t overwrite to null).
      const planPeriod = normalizePeriod(sub.metadata?.plan_period);
      const update = {
        is_premium: sub.status === "active" || sub.status === "trialing",
        premium_expires_at: premiumExpiresAt,
        stripe_price_id: stripePriceId,
        stripe_customer_id: sub.customer,
        plan_tier: sub.status === "active" || sub.status === "trialing" ? "premium" : "free"
      };
      if (planPeriod) update.plan_period = planPeriod;
      const { error } = await supabase.from("profiles").update(update).eq("id", userId);
      if (error) throw error;
      console.log("[stripe-webhook] subscription updated:", {
        userId,
        stripePriceId,
        planPeriod,
        status: sub.status
      });
      return new Response(JSON.stringify({
        received: true
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // 3) Cancelled subscription -> revert to free
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      let userId = sub.metadata?.user_id ?? null;
      if (!userId) {
        const customerId = sub.customer;
        const { data, error } = await supabase.from("profiles").select("id").eq("stripe_customer_id", customerId).single();
        if (!error && data?.id) userId = data.id;
      }
      if (userId) {
        await updateProfileForFree(userId);
        console.log("[stripe-webhook] subscription deleted -> free:", userId);
      }
      return new Response(JSON.stringify({
        received: true
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Ignore other events
    return new Response(JSON.stringify({
      received: true
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    return new Response("Webhook handler error", {
      status: 500
    });
  }
});
