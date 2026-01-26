// supabase/functions/admin-users/index.ts
import { serve } from "@std/http/server";
import { createClient } from "@supabase/supabase-js";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

type JsonObject = Record<string, JsonValue>;

type AdminUsersBody = {
  action?: unknown;
  targetUserId?: unknown;

  // set_admin
  is_admin?: unknown;

  // grant_premium
  plan_period?: unknown;
  premium_expires_at?: unknown;
};

type Period = "weekly" | "monthly" | "annual";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function cors(origin: string | null): Record<string, string> {
  const raw =
    Deno.env.get("ALLOWED_ORIGINS") ??
    ["http://localhost:5173", "https://auditdapps.com", "https://www.auditdapps.com"].join(",");

  const allowed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const o = origin ?? "";
  const allow = allowed.includes(o) ? o : allowed[0] || "*";

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(headers: Record<string, string>, status: number, payload: JsonObject) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function normalizePeriod(p: unknown): Period | null {
  if (!p) return null;
  const v = String(p).toLowerCase().trim();
  if (v === "weekly") return "weekly";
  if (v === "monthly") return "monthly";
  if (v === "annual" || v === "yearly") return "annual";
  return null;
}

function computeExpiry(period: Period, from = new Date()): string {
  const d = new Date(from);
  if (period === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  if (period === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  if (period === "annual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString();
}

async function assertCallerIsAdmin(authHeader: string | null): Promise<
  | { ok: true; callerId: string }
  | { ok: false; status: number; error: string }
> {
  if (!authHeader) return { ok: false, status: 401, error: "Missing authorization" };

  const jwt = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (!jwt) return { ok: false, status: 401, error: "Missing token" };

  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user?.id) return { ok: false, status: 401, error: "Unauthorized" };

  const callerId = data.user.id;

  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("id, is_admin")
    .eq("id", callerId)
    .maybeSingle();

  if (profErr) return { ok: false, status: 500, error: "Could not verify admin status" };
  if (!profile?.is_admin) return { ok: false, status: 403, error: "Admin access required" };

  return { ok: true, callerId };
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json(headers, 405, { error: "Method Not Allowed" });

  const gate = await assertCallerIsAdmin(req.headers.get("authorization"));
  if (!gate.ok) return json(headers, gate.status, { error: gate.error });

  try {
    const body = (await req.json().catch(() => ({}))) as AdminUsersBody;

    const action = typeof body.action === "string" ? body.action : "";
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";

    if (!action) return json(headers, 400, { error: "Missing action" });
    if (!targetUserId) return json(headers, 400, { error: "Missing targetUserId" });

    // Prevent accidental self-delete
    if (action === "delete_user" && targetUserId === gate.callerId) {
      return json(headers, 400, { error: "You cannot delete your own account." });
    }

    if (action === "set_admin") {
      const isAdmin = Boolean(body.is_admin);

      const { data, error } = await admin
        .from("profiles")
        .update({ is_admin: isAdmin, updated_at: new Date().toISOString() })
        .eq("id", targetUserId)
        .select("id, is_admin")
        .single();

      if (error) throw error;

      return json(headers, 200, { ok: true, user: data as JsonValue });
    }

    if (action === "grant_premium") {
      const period = normalizePeriod(body.plan_period) ?? "monthly";

      const expiresAt =
        typeof body.premium_expires_at === "string" && body.premium_expires_at.trim()
          ? body.premium_expires_at.trim()
          : computeExpiry(period);

      const { data, error } = await admin
        .from("profiles")
        .update({
          is_premium: true,
          plan_tier: "premium",
          plan_period: period,
          premium_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId)
        .select("id, is_premium, plan_tier, plan_period, premium_expires_at")
        .single();

      if (error) throw error;

      return json(headers, 200, { ok: true, user: data as JsonValue });
    }

    if (action === "revoke_premium") {
      const { data, error } = await admin
        .from("profiles")
        .update({
          is_premium: false,
          plan_tier: "free",
          plan_period: null,
          stripe_price_id: null,
          premium_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId)
        .select("id, is_premium, plan_tier, plan_period, premium_expires_at")
        .single();

      if (error) throw error;

      return json(headers, 200, { ok: true, user: data as JsonValue });
    }

    if (action === "delete_user") {
      const { error } = await admin.auth.admin.deleteUser(targetUserId);
      if (error) throw error;
      return json(headers, 200, { ok: true });
    }

    return json(headers, 400, { error: "Unknown action" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin-users] error:", e);
    return json(headers, 500, { error: msg });
  }
});
