// src/utils/scannerPrompt.ts
import { getScannerAnalysis } from "./openaiScanner";

type AIFinding = {
  severity?: string;
  title?: string;
  description?: string;
  details?: string;
  remediation?: string;
};

type AIResponseObject = {
  score?: unknown;
  summary_md?: unknown;
  findings?: unknown;
  analysis?: unknown; // legacy wrapper
  error?: unknown;
  raw?: unknown;
  [k: string]: unknown;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function stripMarkdownNoise(text: string): string {
  return (text || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clampScore(n: unknown): number {
  const num = Number(n);
  const safe = Number.isFinite(num) ? num : 0;
  return Math.max(0, Math.min(100, Math.round(safe)));
}

function normalizeSeverity(sev: unknown): "Critical" | "High" | "Medium" | "Low" {
  const s = String(sev || "").toLowerCase().trim();
  if (s === "critical") return "Critical";
  if (s === "high") return "High";
  if (s === "medium") return "Medium";
  if (s === "low") return "Low";
  return "Medium";
}

function coerceAIResult(raw: unknown): {
  summary_md: string;
  findings: AIFinding[];
  score: number;
} {
  // 1) If it's a string, try JSON.parse; if fails, treat as plain summary text.
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) {
      return { summary_md: "No summary was generated.", findings: [], score: 0 };
    }

    // handle accidental fenced json (shouldn't happen with response_format, but safe)
    const fenced = text.match(/```json([\s\S]*?)```/i);
    const jsonCandidate = fenced?.[1]?.trim() ?? text;

    try {
      const parsed = JSON.parse(jsonCandidate) as AIResponseObject;
      return coerceAIResult(parsed);
    } catch {
      return { summary_md: stripMarkdownNoise(text), findings: [], score: 0 };
    }
  }

  // 2) If it's an object, possibly already in correct shape
  if (isPlainObject(raw)) {
    const obj = raw as AIResponseObject;

    // legacy: { analysis: "..." } or { analysis: { ... } }
    if ("analysis" in obj && obj.analysis != null) {
      return coerceAIResult(obj.analysis);
    }

    // if server returned { error: "..." }
    if ("error" in obj && obj.error) {
      const msg = String(obj.error);
      return { summary_md: msg, findings: [], score: 0 };
    }

    const summary_md = stripMarkdownNoise(String(obj.summary_md ?? "").trim());

    const findingsRaw = obj.findings;
    const findings: AIFinding[] = Array.isArray(findingsRaw)
      ? (findingsRaw as AIFinding[])
      : [];

    const score = clampScore(obj.score);

    return {
      summary_md: summary_md || "No summary was generated.",
      findings,
      score,
    };
  }

  // 3) Anything else -> fallback
  return { summary_md: "No summary was generated.", findings: [], score: 0 };
}

export async function analyzeContract({
  chain,
  address,
  sourceCode,
  compiler,
  contracts,
}: {
  chain: string;
  address: string;
  sourceCode: string;
  compiler: string | null;
  contracts: Array<{ name: string; file?: string }>;
}): Promise<{
  summary_md: string;
  findings: Array<{
    severity: "Critical" | "High" | "Medium" | "Low" | string;
    title: string;
    description: string;
    remediation?: string;
  }>;
  score: number;
}> {
  const rubric = `
You are a senior smart contract security auditor with deep expertise in Solidity, the EVM and DeFi protocols.

The system message already told you the exact JSON shape to return.
Focus now on content quality:

- "summary_md":
  - 2–4 short paragraphs.
  - High-level risk posture: how risky is this contract overall and why?
  - Mention major vulnerability themes, notable strengths, and any assumptions.
  - DO NOT enumerate each finding in detail here.
  - DO NOT copy-paste the full text of any finding into the summary.

- "findings":
  - 0–10 items.
  - Each item is a distinct issue, not a restatement of the summary.
  - Use severity strictly from: Critical, High, Medium, Low.
  - Group similar sub-issues into a single finding instead of repeating.
  - "description" should focus on concrete impact, affected components and scenarios.
  - "remediation" must contain specific, actionable guidance (code-level ideas, patterns, or controls).

If the contract appears generally safe, it's okay to return an empty "findings": [] but still write a thoughtful summary and a high score.
`.trim();

  const contractsList =
    contracts && contracts.length
      ? contracts
          .map((c) => `- ${c.name}${c.file ? ` (file: ${c.file})` : ""}`)
          .join("\n")
      : "- Not explicitly specified";

  const MAX_SOURCE_CHARS = 160_000;
  const trimmedSource =
    sourceCode.length > MAX_SOURCE_CHARS
      ? sourceCode.slice(0, MAX_SOURCE_CHARS) + "\n\n// [truncated for length]"
      : sourceCode;

  const context = [
    `Chain: ${chain}`,
    `Address: ${address}`,
    compiler ? `Compiler: ${compiler}` : "Compiler: unknown",
    "Contracts:",
    contractsList,
  ].join("\n");

  // Note: Edge function uses response_format json_object, but we keep this safe anyway.
  const prompt = `${rubric}

Context:
${context}

Solidity source (may be multi-file JSON from an explorer, shown verbatim below):

\`\`\`solidity
${trimmedSource}
\`\`\`
`;

  const raw = await getScannerAnalysis(prompt);
  console.log("[scannerPrompt] raw from OpenAI:", raw);

  const coerced = coerceAIResult(raw);

  const normFindings = (coerced.findings || []).map((f) => {
    const severity = normalizeSeverity(f.severity);
    return {
      severity,
      title: String(f.title || "Security issue"),
      description: String(f.description || f.details || "No description provided."),
      remediation: f.remediation ? String(f.remediation) : undefined,
    };
  });

  return {
    summary_md: coerced.summary_md || "No summary was generated.",
    findings: normFindings,
    score: clampScore(coerced.score),
  };
}
