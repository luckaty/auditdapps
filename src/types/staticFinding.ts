// src/types/staticFinding.ts
export type StaticFinding = {
  tool: "slither";
  check: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  description: string;
  file?: string;
  line?: number;
};