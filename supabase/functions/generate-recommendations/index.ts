// supabase/functions/generate-recommendations/index.ts
import { serve } from "@std/http/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Minimal DB typing for this function only.
 * Keeps Supabase typed without needing full generated Database types.
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
        Args: {
          p_key: string;
          p_reset_at: string; // send ISO string
        };
        Returns: {
          count: number;
          reset_at: string; // comes back as ISO string
        }[];
      };
    };

    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type SB = SupabaseClient<Database, "public">;

type AuditRequestBody = {
  prompt?: unknown;
  analytics?: unknown;
  meta?: unknown;
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STYLE_GUIDE = `
You are a senior smart contract security auditor.
Your job is to generate a concise, professional **markdown** report.

### Output structure (use exactly this order and headings)

# 🧾 Audit Summary
- 2–4 sentences summarising the overall security posture and key themes.

## 🛑 Critical
- <issue> [likelihood: very likely|likely|possible|unlikely|rare] [mitigation: none|partial|full]

## 🚨 High
- <issue> [likelihood: very likely|likely|possible|unlikely|rare] [mitigation: none|partial|full]

## ⚠️ Medium
- <issue> [likelihood: very likely|likely|possible|unlikely|rare] [mitigation: none|partial|full]

## 🟡 Low
- <issue> [likelihood: very likely|likely|possible|unlikely|rare] [mitigation: none|partial|full]

## ✅ Tailored Actionable Recommendations
- <action item, one short line>
- Focus on practical next steps for the specific DApp and codebase.
- Avoid long paragraphs; keep each bullet very focused.

### Style rules

- Use **markdown**, but no HTML tags.
- Be concrete and specific, not generic.
- Do NOT invent details that are not implied by the prompt.
- Group similar issues together when possible.
- Never mention this style guide or that you are an AI model.
`.trim();

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
 * ✅ Production-grade rate limiter: single atomic DB call via SQL function.
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

  if (error || !data || data.length === 0) {
    console.error("[rate-limit] rpc failed:", error);
    return { allowed: true }; // fail-open
  }

  const row = data[0];
  const remainingMs = Math.max(0, new Date(row.reset_at).getTime() - Date.now());

  if (row.count > opts.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(remainingMs / 1000),
    };
  }

  return { allowed: true };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  if (!OPENAI_API_KEY) {
    console.error("[generate-recommendations] Missing OPENAI_API_KEY secret");
    return jsonResponse(500, {
      error: "Server is not configured with OpenAI key.",
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as AuditRequestBody;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return jsonResponse(400, { error: "Missing 'prompt' in request body." });
    }

    // Rate limit BEFORE calling OpenAI
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase: SB = createClient<Database>(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } },
      );

      const identifier = await getCallerIdentifier(req);
      const limit = identifier.kind === "user" ? 3 : 2;

      const rl = await enforceRateLimit({
        supabase,
        route: "generate-recommendations",
        identifier,
        limit,
        windowSeconds: 60,
      });

      if (!rl.allowed) {
        return jsonResponse(
          429,
          {
            error: "Too many requests. Please try again shortly.",
            retry_after_seconds: rl.retryAfterSeconds,
          },
          { "Retry-After": String(rl.retryAfterSeconds) },
        );
      }
    } else {
      console.warn(
        "[generate-recommendations] Rate limiting disabled (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)",
      );
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.0,
        top_p: 1,
        presence_penalty: 0,
        frequency_penalty: 0,
        max_tokens: 900,
        messages: [
          { role: "system", content: STYLE_GUIDE },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text().catch(() => "");
      console.error(
        "[generate-recommendations] OpenAI error:",
        openaiRes.status,
        text,
      );
      return jsonResponse(500, {
        error: "OpenAI request failed",
        status: openaiRes.status,
      });
    }

    const data = (await openaiRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const recommendations = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return jsonResponse(200, { recommendations });
  } catch (err) {
    console.error("[generate-recommendations] Unexpected error:", err);
    return jsonResponse(500, {
      error: "Unexpected error generating recommendations",
    });
  }
});
