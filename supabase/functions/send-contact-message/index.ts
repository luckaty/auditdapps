// supabase/functions/send-contact-message/index.ts

import { serve } from "@std/http/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Minimal DB typing for this function only.
 * Includes rate_limits table + rate_limit_hit() RPC for atomic increments.
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

type ContactBody = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  subject?: unknown;
  message?: unknown;
};

// Env
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? ""; // e.g. "AuditDapps <no-reply@auditdapps.com>"
const RESEND_TO = Deno.env.get("RESEND_TO") ?? "info@auditdapps.com";

// For per-user/IP rate limiting
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// CORS (tighten with allowlist later)
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
 * Production-grade rate limiter using atomic Postgres function (rate_limit_hit).
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

  // Atomic increment in DB
  const { data, error } = await opts.supabase.rpc("rate_limit_hit", {
    p_key: key,
    p_reset_at: resetAtIso,
  });

  if (error || !data?.[0]) {
    console.error("[rate-limit] rpc failed:", error);
    return { allowed: true }; // fail-open (avoid accidental outages)
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

// Basic helpers
function toStringSafe(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function isEmailLike(email: string): boolean {
  // lightweight sanity check (don’t overcomplicate)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clampText(input: string, max: number): string {
  const s = input.trim();
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function stripNewlines(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
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

  // --- Rate limit (before doing work) ---
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const supabase: SB = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );

    const identifier = await getCallerIdentifier(req);

    /**
     * Suggested production limits for contact form:
     * - Authenticated: 5/min
     * - Unauthenticated: 2/min
     *
     * This blocks bots + keeps your inbox safe.
     */
    const limit = identifier.kind === "user" ? 5 : 2;

    const rl = await enforceRateLimit({
      supabase,
      route: "send-contact-message",
      identifier,
      limit,
      windowSeconds: 60,
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
      "[send-contact-message] Rate limiting disabled (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  // --- Validate env ---
  if (!RESEND_API_KEY || !RESEND_FROM || !RESEND_TO) {
    console.error("[send-contact-message] Missing RESEND env vars");
    return jsonResponse(500, { ok: false, error: "Server misconfigured" });
  }

  // --- Parse body ---
  let body: ContactBody = {};
  try {
    body = (await req.json().catch(() => ({}))) as ContactBody;
  } catch {
    body = {};
  }

  // --- Sanitize + validate ---
  const name = clampText(toStringSafe(body.name), 80);
  const email = clampText(toStringSafe(body.email), 120);
  const phone = clampText(toStringSafe(body.phone), 40);
  const subjectRaw = clampText(toStringSafe(body.subject), 120);
  const subject = subjectRaw ? stripNewlines(subjectRaw) : "New contact form message";
  const message = clampText(toStringSafe(body.message), 4000);

  if (!name || !email || !message) {
    return jsonResponse(400, {
      ok: false,
      error: "missing_fields",
      fields: {
        name: !name ? "required" : "ok",
        email: !email ? "required" : "ok",
        message: !message ? "required" : "ok",
      },
    });
  }

  if (!isEmailLike(email)) {
    return jsonResponse(400, { ok: false, error: "invalid_email" });
  }

  // --- Build email text ---
  const text = [
    "New contact form message from auditdapps.com",
    "",
    `Name:   ${name}`,
    `Email:  ${email}`,
    `Phone:  ${phone || "(not provided)"}`,
    "",
    `Subject: ${subject}`,
    "",
    "Message:",
    message,
  ].join("\n");

  // --- Send via Resend ---
  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [RESEND_TO],
        subject: `Contact form: ${subject}`,
        text,
        reply_to: email || undefined,
      }),
    });

    const payload = (await resendRes.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!resendRes.ok) {
      console.error("[send-contact-message] Resend error:", resendRes.status, payload);
      return jsonResponse(500, {
        ok: false,
        error: "email_send_failed",
        status: resendRes.status,
      });
    }

    const id = typeof payload?.id === "string" ? payload.id : null;

    return jsonResponse(200, { ok: true, id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-contact-message] Unhandled error:", msg);
    return jsonResponse(500, { ok: false, error: "internal_error" });
  }
});
