// supabase/functions/send-manual-audit/index.ts
import { serve } from "@std/http/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Minimal DB typing (rate_limits table + rate_limit_hit RPC).
 * Matches your SQL function:
 *   public.rate_limit_hit(p_key text, p_reset_at timestamptz)
 */
type Database = {
  public: {
    Tables: {
      rate_limits: {
        Row: {
          key: string;
          count: number;
          reset_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          count?: number;
          reset_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          count?: number;
          reset_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
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

type ManualAuditBody = {
  project?: unknown;
  contact?: unknown;
  notes?: unknown;
  user_id?: unknown;
  email?: unknown;
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? ""; // e.g. "AuditDapps Notifications <no-reply@auditdapps.com>"
const RESEND_TO = Deno.env.get("RESEND_TO") ?? "info@auditdapps.com";

// For rate limiting
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// CORS (tighten later with allowlist)
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
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

async function getCallerIdentifier(
  req: Request,
): Promise<{ kind: "user" | "ip"; id: string }> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";

  // Prefer verified user id when JWT exists
  if (token && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabaseAuth = createClient<Database>(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } },
      );

      const { data, error } = await supabaseAuth.auth.getUser(token);
      if (!error && data?.user?.id) {
        return { kind: "user", id: data.user.id };
      }
    } catch {
      // fall back to IP
    }
  }

  return { kind: "ip", id: getClientIp(req) ?? "unknown-ip" };
}

/**
 * Atomic Postgres rate limiter using your RPC.
 * Key format: <route>:<kind>:<id>:<bucketStartIso>
 */
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

  if (error || !data?.[0]) {
    console.error("[rate-limit] rpc failed:", error);
    return { allowed: true }; // fail-open
  }

  const count = data[0].count ?? 0;
  const resetAt = data[0].reset_at;

  const remainingMs = Math.max(0, new Date(resetAt).getTime() - Date.now());

  if (count > opts.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(remainingMs / 1000),
    };
  }

  return { allowed: true };
}

// Helpers
function toStringSafe(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function clampText(input: string, max: number): string {
  const s = input.trim();
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function stripNewlines(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}

function isEmailLike(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

serve(async (req: Request) => {
  // --- CORS preflight ---
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  // --- Rate limit early ---
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const supabase: SB = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );

    const identifier = await getCallerIdentifier(req);

    /**
     * Suggested production limits for manual audit request:
     * - Authenticated: 2 per 10 minutes
     * - Unauthenticated: 1 per 10 minutes
     *
     * Reason: this endpoint triggers human workflow + inbox load.
     */
    const windowSeconds = 10 * 60;
    const limit = identifier.kind === "user" ? 2 : 1;

    const rl = await enforceRateLimit({
      supabase,
      route: "send-manual-audit",
      identifier,
      limit,
      windowSeconds,
    });

    if (!rl.allowed) {
      return jsonResponse(
        429,
        {
          ok: false,
          error: "Too many requests. Please try again shortly.",
          retry_after_seconds: rl.retryAfterSeconds,
        },
        { "Retry-After": String(rl.retryAfterSeconds) },
      );
    }
  } else {
    console.warn(
      "[send-manual-audit] Rate limiting disabled (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  // --- Validate env ---
  if (!RESEND_API_KEY || !RESEND_FROM || !RESEND_TO) {
    console.error("[send-manual-audit] Missing RESEND env vars");
    return jsonResponse(500, { ok: false, error: "Server misconfigured" });
  }

  // --- Parse body ---
  let body: ManualAuditBody = {};
  try {
    body = (await req.json().catch(() => ({}))) as ManualAuditBody;
  } catch {
    body = {};
  }

  // --- Sanitize + validate ---
  const project = stripNewlines(clampText(toStringSafe(body.project), 140));
  const contact = clampText(toStringSafe(body.contact), 200);
  const notes = clampText(toStringSafe(body.notes), 6000);
  const user_id = stripNewlines(clampText(toStringSafe(body.user_id), 64));
  const email = stripNewlines(clampText(toStringSafe(body.email), 120));

  if (!project || !contact || !user_id) {
    return jsonResponse(400, {
      ok: false,
      error: "missing_fields",
      fields: {
        project: !project ? "required" : "ok",
        contact: !contact ? "required" : "ok",
        user_id: !user_id ? "required" : "ok",
      },
    });
  }

  if (email && !isEmailLike(email)) {
    return jsonResponse(400, { ok: false, error: "invalid_email" });
  }

  // --- Build email ---
  const text = [
    "New manual audit request",
    "",
    `Project: ${project}`,
    `Contact: ${contact}`,
    "",
    "Notes:",
    notes || "(none)",
    "",
    `User ID: ${user_id}`,
    email ? `User Email: ${email}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // --- Send via Resend ---
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [RESEND_TO],
        subject: `Manual Audit Request — ${project}`,
        text,
        reply_to: email || contact || undefined,
      }),
    });

    const payload = (await r.json().catch(() => ({}))) as Record<string, unknown>;

    if (!r.ok) {
      console.error("[send-manual-audit] Resend error:", r.status, payload);
      return jsonResponse(500, {
        ok: false,
        error: "email_send_failed",
        status: r.status,
      });
    }

    const id = typeof payload?.id === "string" ? payload.id : null;

    return jsonResponse(200, { ok: true, id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-manual-audit] Unhandled error:", msg);
    return jsonResponse(500, { ok: false, error: "internal_error" });
  }
});
