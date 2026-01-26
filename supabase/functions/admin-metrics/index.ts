// supabase/functions/admin-metrics/index.ts
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

type AdminMetricsBody = {
  days?: unknown;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
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

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
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
    const body = (await req.json().catch(() => ({}))) as AdminMetricsBody;

    const daysRaw = body.days;
    const daysNum = typeof daysRaw === "number" ? daysRaw : Number(daysRaw);

    const rangeDays =
      Number.isFinite(daysNum) ? Math.min(Math.max(daysNum, 7), 90) : 30;

    const since7 = isoDaysAgo(7);
    const since30 = isoDaysAgo(30);
    const sinceRange = isoDaysAgo(rangeDays);

    // Counts
    const [
      totalUsers,
      newUsers7,
      newUsers30,
      totalAudits,
      audits24h,
      audits7,
      feedback7,
      manualReq7,
    ] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since7),
      admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since30),
      admin.from("audits").select("id", { count: "exact", head: true }),
      admin.from("audits").select("id", { count: "exact", head: true }).gte("created_at", isoDaysAgo(1)),
      admin.from("audits").select("id", { count: "exact", head: true }).gte("created_at", since7),
      admin.from("product_feedback").select("id", { count: "exact", head: true }).gte("created_at", since7),
      admin.from("manual_audit_requests").select("id", { count: "exact", head: true }).gte("created_at", since7),
    ]);

    // Avg score (last 30 days)
    const { data: auditScores, error: scoreErr } = await admin
      .from("audits")
      .select("overall_pct")
      .gte("created_at", since30)
      .not("overall_pct", "is", null)
      .limit(5000);

    if (scoreErr) throw scoreErr;

    const avgScore30 =
      auditScores && auditScores.length
        ? Math.round(
            auditScores.reduce((acc: number, r: { overall_pct: number | null }) => {
              return acc + Number(r.overall_pct ?? 0);
            }, 0) / auditScores.length,
          )
        : null;

    // Premium active users (approx)
    const nowIso = new Date().toISOString();
    const { count: premiumActiveCount, error: premErr } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .or(`premium_expires_at.gt.${nowIso},is_premium.eq.true`);

    if (premErr) throw premErr;

    // Open high/critical recs
    const { count: openHighCritical, error: recErr } = await admin
      .from("recommendations")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .in("severity", ["Critical", "High"]);

    if (recErr) throw recErr;

    // Charts via RPC (assumes these functions exist)
    const { data: auditsPerDay, error: apdErr } = await admin.rpc("admin_audits_per_day", {
      from_ts: sinceRange,
    });
    if (apdErr) throw apdErr;

    const { data: severityDist, error: sevErr } = await admin.rpc("admin_severity_distribution", {
      from_ts: sinceRange,
    });
    if (sevErr) throw sevErr;

    const { data: premiumTrend, error: ptErr } = await admin.rpc("admin_premium_trend", {
      from_ts: sinceRange,
    });
    if (ptErr) throw ptErr;

    const { data: feedbackTrend, error: ftErr } = await admin.rpc("admin_feedback_trend", {
      from_ts: sinceRange,
    });
    if (ftErr) throw ftErr;

    return json(headers, 200, {
      ok: true,
      rangeDays,
      cards: {
        users: totalUsers.count ?? 0,
        newUsers7: newUsers7.count ?? 0,
        newUsers30: newUsers30.count ?? 0,
        audits: totalAudits.count ?? 0,
        audits24h: audits24h.count ?? 0,
        audits7: audits7.count ?? 0,
        avgScore30,
        premiumActive: premiumActiveCount ?? 0,
        openHighCritical: openHighCritical ?? 0,
        manualReq7: manualReq7.count ?? 0,
        feedback7: feedback7.count ?? 0,
      },
      charts: {
        auditsPerDay,
        severityDist,
        premiumTrend,
        feedbackTrend,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(headers, 500, { error: msg });
  }
});
