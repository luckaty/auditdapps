// src/utils/openaiScanner.ts
import { supabase } from "@/lib/supabaseClient";

export type ScannerAIResponse =
  | string
  | {
      score?: number;
      summary_md?: string;
      findings?: unknown[];
      error?: string;
      raw?: unknown;
      [k: string]: unknown;
    };

export async function getScannerAnalysis(prompt: string): Promise<unknown> {
  const p = (prompt ?? "").trim();
  if (!p) throw new Error("Prompt is empty.");

  const { data, error } = await supabase.functions.invoke("scanner-analyze", {
    body: { prompt: p },
  });

  if (error) {
    console.error("[getScannerAnalysis] invoke error:", error);
    throw new Error(error.message || "Failed to run scanner. Please try again.");
  }

  // If your Edge Function returns { error: "..." } with 200, surface it.
  if (data && typeof data === "object" && "error" in (data as any)) {
    const msg = String((data as any).error || "Scanner error");
    console.error("[getScannerAnalysis] function returned error payload:", data);
    throw new Error(msg);
  }

  if (data == null) {
    console.error("[getScannerAnalysis] empty payload:", data);
    throw new Error("Scanner returned an empty response.");
  }

  // ✅ Return the JSON object (preferred) or string (legacy)
  return data;
}
