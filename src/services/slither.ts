import type { StaticFinding } from "@/types/staticFinding";

type SlitherAnalyzeResponse = {
  tool: "slither";
  count: number;
  findings: StaticFinding[];
};

const BASE_URL =
  import.meta.env.VITE_SLITHER_API_URL?.trim() || "http://127.0.0.1:8001";

export async function runSlitherAnalysis(args: {
  source_code: string;
  filename?: string;
}): Promise<StaticFinding[]> {
  const res = await fetch(`${BASE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_code: args.source_code,
      filename: args.filename ?? "Contract.sol",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Slither API error (${res.status}): ${text || "Unknown error"}`);
  }

  const data = (await res.json()) as Partial<SlitherAnalyzeResponse>;

  return (data.findings ?? []) as StaticFinding[];
}
