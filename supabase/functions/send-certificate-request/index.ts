//function/send-certificate-request
import { serve } from "@std/http/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Database = {
  public: {
    Tables: {
      rate_limits: {
        Row: { key: string; count: number; reset_at: string };
        Insert: { key: string; count?: number; reset_at: string };
        Update: { count?: number; reset_at?: string };
        Relationships: [];
      };
      // Optional if you want to verify audit ownership:
      // audits: { Row: { id: string; user_id: string }; Insert: never; Update: never; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      rate_limit_hit: {
        Args: { p_key: string; p_reset_at: string };
        Returns: { count: number; reset_at: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type SB = SupabaseClient<Database, "public">;

type Body = {
  project?: unknown;
  repo?: unknown;
  audit_id?: unknown;
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "";
const RESEND_TO = Deno.env.get("RESEND_TO") ?? "info@auditdapps.com";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function buildCors(origin: string | null): Record<string, string> {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ??
    ["http://localhost:5173", "https://auditdapps.com", "https://www.auditdapps.com"].join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const o = (origin ?? "").trim();
  const allow = allowed.includes(o) ? o : (allowed[0] ?? "*");

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(status: number, payload: Record<string, unknown>, headers: Record<string, string>, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, "Content-Type": "application/json", ...extra },
  });
}

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

async function getCaller(req: Request): Promise<{ kind: "user" | "ip"; id: string; email?: string }> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

  if (token && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const supa = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data, error } = await supa.auth.getUser(token);
    if (!error && data?.user?.id) {
      return { kind: "user", id: data.user.id, email: data.user.email ?? undefined };
    }
  }

  return { kind: "ip", id: getClientIp(req) ?? "unknown-ip" };
}

async function enforceRateLimit(opts: {
  supabase: SB;
  route: string;
  identifier: { kind: "user" | "ip"; id: string };
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const now = Date.now();
  const windowMs = opts.windowSeconds * 1000;
  const bucketStart = Math.floor(now / windowMs) * windowMs;

  const bucketIso = new Date(bucketStart).toISOString();
  const resetAtIso = new Date(bucketStart + windowMs).toISOString();

  const key = `${opts.route}:${opts.identifier.kind}:${opts.identifier.id}:${bucketIso}`;

  const { data, error } = await opts.supabase.rpc("rate_limit_hit", {
    p_key: key,
    p_reset_at: resetAtIso,
  });

  // Fail-open (don’t break prod if DB hiccups)
  if (error || !data?.[0]) {
    console.error("[rate-limit] rate_limit_hit failed:", error);
    return { allowed: true };
  }

  const count = data[0].count ?? 0;
  const resetAt = data[0].reset_at;

  if (count > opts.limit) {
    const remainingMs = Math.max(0, new Date(resetAt).getTime() - Date.now());
    return { allowed: false, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
  }

  return { allowed: true };
}

serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  if (!RESEND_API_KEY || !RESEND_FROM) {
    return json(500, { error: "Server missing RESEND_API_KEY or RESEND_FROM" }, cors);
  }

  // Recommend requiring auth for certificate requests
  const caller = await getCaller(req);
  if (caller.kind !== "user") {
    return json(401, { error: "Authentication required" }, cors);
  }

  // Rate limit (strict)
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const supabase: SB = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const rl = await enforceRateLimit({
      supabase,
      route: "send-certificate-request",
      identifier: { kind: caller.kind, id: caller.id },
      limit: 1,
      windowSeconds: 10 * 60, // 10 minutes
    });

    if (!rl.allowed) {
      return json(
        429,
        { error: "Too many requests. Please try again shortly.", retry_after_seconds: rl.retryAfterSeconds },
        cors,
        { "Retry-After": String(rl.retryAfterSeconds) },
      );
    }
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  const project = typeof body.project === "string" ? body.project.trim() : "";
  const repo = typeof body.repo === "string" ? body.repo.trim() : "";
  const auditId = typeof body.audit_id === "string" ? body.audit_id.trim() : "";

  if (!project || !repo) {
    return json(400, { ok: false, error: "missing_fields" }, cors);
  }

  // Basic size guard
  if (project.length > 120 || repo.length > 300 || auditId.length > 120) {
    return json(400, { ok: false, error: "invalid_input" }, cors);
  }

  // Optional: verify audit belongs to caller before emailing
  // (uncomment if you have audits table + user_id)
  // const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  // if (auditId) {
  //   const { data, error } = await supabase.from("audits").select("id,user_id").eq("id", auditId).maybeSingle();
  //   if (error) return json(500, { ok: false, error: "audit_lookup_failed" }, cors);
  //   if (!data || data.user_id !== caller.id) return json(403, { ok: false, error: "forbidden" }, cors);
  // }

  const text = `
Certificate Review Request

Project: ${project}
Repository: ${repo}
Audit ID: ${auditId || "(none)"}

Requester User ID: ${caller.id}
Requester Email: ${caller.email || "(none)"}

The user states they have fully implemented all recommendations.
`.trim();

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [RESEND_TO],
      subject: `Certificate Request — ${project}`,
      text,
      reply_to: caller.email || undefined,
    }),
  });

  const j = await r.json().catch(() => ({} as Record<string, unknown>));

  if (!r.ok) {
    console.error("[send-certificate-request] resend error:", r.status, j);
    return json(500, { ok: false, error: "email_failed" }, cors);
  }

  return json(200, { ok: true, id: (j as { id?: string }).id ?? null }, cors);
});
