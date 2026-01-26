// supabase/functions/scanner-analyze/index.ts
import { serve } from "@std/http/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

/**
 * Minimal DB typing (only what this function uses).
 * Includes the RPC function rate_limit_hit.
 */
type Database = {
  public: {
    Tables: {
      rate_limits: {
        Row: { key: string; count: number; reset_at: string };
        Insert: { key: string; count?: number; reset_at: string };
        Update: { count?: number; reset_at?: string };
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

type StaticFinding = {
  title?: string;
  severity?: "Critical" | "High" | "Medium" | "Low" | string;
  description?: string;
  remediation?: string;
  [k: string]: unknown;
};

type ScannerAnalyzeBody = {
  // Legacy support
  prompt?: unknown;

  // Preferred inputs
  selfAuditAnswers?: unknown;
  staticFindings?: unknown;
  sourceCode?: unknown;
  metadata?: unknown;
};

type CallerIdentifier = { kind: "user" | "ip"; id: string };

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Optional: set ALLOWED_ORIGINS="https://auditdapps.com,https://www.auditdapps.com"
function buildCorsHeaders(origin: string | null): Record<string, string> {
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

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string>,
  extra: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      ...extra,
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

async function getCallerIdentifier(req: Request): Promise<CallerIdentifier> {
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
 * Atomic limiter using your SQL function public.rate_limit_hit.
 * Key format: <route>:<kind>:<id>:<bucketStartIso>
 */
async function enforceRateLimit(opts: {
  supabase: SB;
  route: string;
  identifier: CallerIdentifier;
  limit: number; // max requests per window
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

  // Fail-open: never block production if limiter breaks
  if (error || !data?.[0]) {
    console.error("[rate-limit] rpc rate_limit_hit failed:", error);
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

// Style guide (server-side only)
const STYLE_GUIDE = `
You are a senior Solidity smart contract security auditor.

You MUST respond with a single JSON object with this exact shape:

{
  "score": number,
  "summary_md": string,
  "findings": [
    {
      "title": string,
      "severity": "Critical" | "High" | "Medium" | "Low",
      "description": string,
      "remediation": string
    }
  ]
}

Hard requirements:
- Do NOT include backticks, code fences, or any text before/after the JSON.
- score is 0-100 (higher = safer overall).
- summary_md is 2–4 short paragraphs of markdown text (no headings, no fences).
- findings: 0–10 items, distinct issues, no duplicates.
- Do NOT invent vulnerabilities not supported by the inputs.
`.trim();

function safeJsonParse(input: string): unknown | null {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function buildPrompt(input: {
  selfAuditAnswers: unknown;
  staticFindings: StaticFinding[];
  sourceCode?: string;
  metadata?: unknown;
}): string {
  const findingsSection = JSON.stringify(input.staticFindings ?? [], null, 2);
  const answersSection = JSON.stringify(input.selfAuditAnswers ?? {}, null, 2);
  const metaSection = JSON.stringify(input.metadata ?? {}, null, 2);

  const codeSection =
    typeof input.sourceCode === "string" && input.sourceCode.trim().length > 0
      ? input.sourceCode.trim()
      : null;

  return `
You are auditing a Solidity project using the following inputs.

1) Static Analysis Findings (Slither)
${findingsSection}

2) Self-Audit Answers (Project context)
${answersSection}

Project metadata (optional):
${metaSection}

${codeSection ? `Source code snippet (optional):\n${codeSection}\n` : ""}

Rules:
- Prioritize real vulnerabilities first (Critical/High), then design risks, then best practices.
- Do NOT invent vulnerabilities not supported by inputs.
- If findings overlap, merge them into one clean issue.
- Explain impact and remediation clearly and concretely.

Return ONLY the JSON object described in the system instructions.
`.trim();
}

export default serve(async (req: Request) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: cors,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" }, cors);
  }

  if (!OPENAI_API_KEY) {
    return jsonResponse(500, { error: "Missing OPENAI_API_KEY" }, cors);
  }

  // --- Rate limit BEFORE OpenAI ---
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const supabase: SB = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );

    const identifier = await getCallerIdentifier(req);

    // Tune these if needed
    const limit = identifier.kind === "user" ? 3 : 2; // per minute
    const windowSeconds = 60;

    const rl = await enforceRateLimit({
      supabase,
      route: "scanner-analyze",
      identifier,
      limit,
      windowSeconds,
    });

    if (!rl.allowed) {
      return jsonResponse(
        429,
        {
          error: "Too many requests. Please try again shortly.",
          retry_after_seconds: rl.retryAfterSeconds,
        },
        cors,
        { "Retry-After": String(rl.retryAfterSeconds) },
      );
    }
  } else {
    console.warn(
      "[scanner-analyze] Rate limiting disabled (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  let body: ScannerAnalyzeBody = {};
  try {
    body = (await req.json()) as ScannerAnalyzeBody;
  } catch {
    body = {};
  }

  // Truncate huge payloads
  const MAX_CODE_CHARS = 120_000;
  let sourceCode =
    typeof body.sourceCode === "string" ? body.sourceCode : undefined;

  if (typeof sourceCode === "string" && sourceCode.length > MAX_CODE_CHARS) {
    sourceCode =
      sourceCode.slice(0, MAX_CODE_CHARS) + "\n\n// [truncated]";
  }

  const legacyPrompt =
    typeof body.prompt === "string" ? body.prompt.trim() : "";

  const usesLegacyPrompt = legacyPrompt.length > 0;

  // Validate non-legacy inputs
  const selfAuditAnswers = body.selfAuditAnswers;
  const staticFindingsRaw = body.staticFindings;
  const metadata = body.metadata;

  const staticFindings: StaticFinding[] = Array.isArray(staticFindingsRaw)
    ? (staticFindingsRaw as StaticFinding[])
    : [];

  if (!usesLegacyPrompt) {
    const hasFindings = staticFindings.length > 0;
    const hasAnswers = selfAuditAnswers !== undefined;
    const hasCode = typeof sourceCode === "string" && sourceCode.trim().length > 0;

    if (!hasFindings && !hasAnswers && !hasCode) {
      return jsonResponse(
        400,
        {
          error:
            "Missing input. Provide either { prompt } OR { selfAuditAnswers/staticFindings/sourceCode }",
        },
        cors,
      );
    }
  }

  const prompt = usesLegacyPrompt
    ? legacyPrompt
    : buildPrompt({
      selfAuditAnswers,
      staticFindings,
      sourceCode,
      metadata: isRecord(metadata) ? metadata : undefined,
    });

  // --- OpenAI call ---
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 900,
      messages: [
        { role: "system", content: STYLE_GUIDE },
        { role: "user", content: prompt },
      ],
    });

    const content = completion.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = safeJsonParse(content);

    if (isRecord(parsed) && typeof parsed.score === "number") {
      return jsonResponse(200, parsed, cors);
    }

    return jsonResponse(
      500,
      { error: "Model returned invalid JSON", raw: content },
      cors,
    );
  } catch (err) {
    console.error("[scanner-analyze] error:", err);
    return jsonResponse(500, { error: "Internal error" }, cors);
  }
});
