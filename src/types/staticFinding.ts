// src/types/staticFinding.ts

export type StaticSeverity = "Critical" | "High" | "Medium" | "Low" | "Info";

export type StaticFinding = {
  tool: "slither";
  detector: string;         // e.g. "reentrancy-eth"
  severity: StaticSeverity; // normalized
  confidence: string;       // keep flexible
  title: string;            // short human title
  description: string;      // full text
  where?: string | null;    // optional location
};
