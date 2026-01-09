import { useMemo, useState } from "react";
import {
  Shield,
  Loader2,
  AlertTriangle,
  UploadCloud,
  FileDown,
} from "lucide-react";
import { analyzeContract } from "@/utils/scannerPrompt";
import { useNavigate } from "react-router-dom";
import DashThemeToggle from "@/components/DashThemeToggle";

import { runSlitherAnalysis } from "@/services/slither";
import type { StaticFinding } from "@/types/staticFinding";

// PDF libraries
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type AIFinding = {
  severity: "Critical" | "High" | "Medium" | "Low" | string;
  title: string;
  description: string;
  remediation?: string;
};

type FindingCardModel = {
  severity: string;
  title: string;
  description: string;
  remediation?: string;
};

function normalizeSource(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+$/gm, "") // trim trailing spaces per line
    .trim();
}

export default function ScannerPage() {
  const navigate = useNavigate();

  const [compiler, setCompiler] = useState("");
  const [sourceCode, setSourceCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ✅ Slither error visibility
  const [slitherError, setSlitherError] = useState<string | null>(null);

  const [score, setScore] = useState<number | null>(null);
  const [summaryMd, setSummaryMd] = useState<string | null>(null);

  // AI findings (from your Edge Function)
  const [aiFindings, setAiFindings] = useState<AIFinding[]>([]);

  // Slither findings (deterministic)
  const [staticFindings, setStaticFindings] = useState<StaticFinding[]>([]);

  const hasResults =
    score !== null ||
    !!summaryMd ||
    aiFindings.length > 0 ||
    staticFindings.length > 0 ||
    !!slitherError;

  const totalFindingsCount = staticFindings.length + aiFindings.length;

  const canRunScan = useMemo(() => {
    return !loading && normalizeSource(sourceCode).length > 0;
  }, [loading, sourceCode]);

  /* ------------------------ PDF EXPORT ------------------------ */
  const exportPDF = () => {
    if (!summaryMd && aiFindings.length === 0 && staticFindings.length === 0) return;

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("AuditDApps Smart Contract Scan Report", 14, 16);

    doc.setFontSize(12);
    doc.text(`Security Score: ${score ?? "--"}/100`, 14, 26);

    doc.setFontSize(14);
    doc.text("Executive Summary", 14, 40);

    doc.setFontSize(11);
    const summaryLines = doc.splitTextToSize(summaryMd ?? "", 180);
    doc.text(summaryLines, 14, 48);

    // Combine: Slither first, then AI
    const allRows: Array<[string, string, string, string]> = [
      ...staticFindings.map(
        (f: StaticFinding): [string, string, string, string] => {
          const desc = String(f.description ?? "");
          const where = f.where ? String(f.where) : "";
          return [
            String(f.severity),
            `[Slither] ${String(f.title ?? "")}`,
            where ? `${desc}\nWhere: ${where}` : desc,
            "—",
          ];
        }
      ),

      ...aiFindings.map(
        (f: AIFinding): [string, string, string, string] => [
          String(f.severity),
          String(f.title),
          String(f.description),
          String(f.remediation ?? "—"),
        ]
      ),
    ];

    if (allRows.length > 0) {
      autoTable(doc, {
        startY: Math.max(60, 60 + summaryLines.length * 5),
        head: [["Severity", "Title", "Description", "Remediation"]],
        body: allRows,
        styles: { fontSize: 9, cellWidth: "wrap" },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 45 },
          2: { cellWidth: 75 },
          3: { cellWidth: 45 },
        },
      });
    }

    doc.save("auditdapps_scan_report.pdf");
  };

  /* ------------------------ RUN SCAN ------------------------ */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setUploadError(null);
    setSlitherError(null);

    const source = normalizeSource(sourceCode);
    if (!source) {
      setError("Paste or upload Solidity source before running a scan.");
      return;
    }

    setLoading(true);

    // reset results
    setScore(null);
    setSummaryMd(null);
    setAiFindings([]);
    setStaticFindings([]);

    try {
      // 1) Run Slither first (doesn't block AI if it fails)
      try {
        const slither = await runSlitherAnalysis({
          source_code: source,
          filename: "Contract.sol",
        });
        setStaticFindings(slither);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setSlitherError(msg);
        setStaticFindings([]);
      }

      // 2) Run AI analysis
      const result = await analyzeContract({
        chain: "EVM",
        address: "N/A",
        sourceCode: source,
        compiler: compiler.trim() || null,
        contracts: [],
      });

      setScore(result.score);
      setSummaryMd(result.summary_md);
      setAiFindings(result.findings || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "We couldn’t complete the scan. Try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------ FILE UPLOAD ------------------------ */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    const MAX_BYTES = 1.5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setUploadError("File too large. Please upload a smaller flattened source.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || "");
      setSourceCode(text);
    };
    reader.onerror = () => {
      setUploadError("Unable to read file. Please try again.");
    };
    reader.readAsText(file);
  };

  /* ------------------------ SCORE COLOR ------------------------ */
  const scoreTone = (() => {
    if (score === null) return "bg-slate-700/60 text-slate-50";
    if (score >= 85) return "bg-emerald-600 text-emerald-50";
    if (score >= 70) return "bg-amber-500 text-amber-50";
    if (score >= 50) return "bg-orange-500 text-orange-50";
    return "bg-rose-600 text-rose-50";
  })();

  /* ------------------------ UI ------------------------ */
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <header className="mb-6 md:mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          {/* LEFT SIDE */}
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white grid place-items-center shadow-md">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Smart Contract Scanner
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-xl">
                Upload or paste Solidity source and generate an executive summary + findings.
              </p>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex flex-col items-end gap-2 text-[11px] text-muted-foreground md:text-right">
            <div className="flex items-center gap-2">
              <DashThemeToggle />
              <button
                onClick={() => navigate("/dashboard")}
                className="px-3 h-9 inline-flex items-center rounded-full text-[11px] font-medium border border-border bg-card hover:bg-accent/60"
              >
                ← Back to dashboard
              </button>
            </div>
            <p className="max-w-xs">
              Automated analysis only — always review critical code manually.
            </p>
          </div>
        </header>

        {/* CONTENT GRID */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] items-start">
          {/* LEFT: Form */}
          <section className="rounded-2xl border border-border bg-card/90 backdrop-blur p-5 shadow-sm">
            <h2 className="text-sm font-semibold mb-2">Scan parameters</h2>

            <form className="space-y-4" onSubmit={onSubmit}>
              {/* Compiler */}
              <div>
                <label htmlFor="compiler" className="block text-xs font-medium mb-1">
                  Compiler version
                </label>
                <input
                  id="compiler"
                  type="text"
                  value={compiler}
                  onChange={(e) => setCompiler(e.target.value)}
                  placeholder="e.g. 0.8.23"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Upload + Textarea */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="sourceCode" className="block text-xs font-medium">
                    Solidity source
                  </label>

                  <label
                    htmlFor="upload"
                    className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-1.5 text-[11px] cursor-pointer hover:bg-accent/40"
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span>Upload</span>
                    <input
                      id="upload"
                      type="file"
                      accept=".sol,.txt,.json"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>

                <textarea
                  id="sourceCode"
                  value={sourceCode}
                  onChange={(e) => setSourceCode(e.target.value)}
                  rows={12}
                  placeholder="Paste Solidity source code here…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono"
                />

                {uploadError && (
                  <div className="text-xs text-rose-600">{uploadError}</div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-rose-500/60 bg-rose-50 px-3 py-2 text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {/* Run button */}
              <button
                type="submit"
                disabled={!canRunScan}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                {loading ? "Running…" : "Run security scan"}
              </button>
            </form>
          </section>

          {/* RIGHT: Results */}
          <section className="space-y-4">
            {/* SCORE + SUMMARY */}
            <div className="rounded-2xl border border-border bg-card/90 backdrop-blur p-5 shadow-sm">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-semibold">Overall security posture</h2>

                {hasResults && (
                  <button
                    onClick={exportPDF}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent/60"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Export PDF
                  </button>
                )}
              </div>

              <div className="flex justify-between items-start mt-3">
                <p className="text-xs text-muted-foreground max-w-md">
                  The score is a high-level indicator. Combine this with manual review.
                </p>

                <div
                  className={`relative h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold ${scoreTone}`}
                >
                  {score !== null ? score : "--"}
                  <span className="absolute text-[9px] uppercase bottom-2 opacity-75">
                    score
                  </span>
                </div>
              </div>

              {summaryMd && (
                <div className="mt-4 border-t border-border pt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 mb-2">
                    Executive summary
                  </div>
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">
                    {summaryMd}
                  </p>
                </div>
              )}
            </div>

            {/* FINDINGS */}
            <div className="rounded-2xl border border-border bg-card/90 backdrop-blur p-5 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold">Findings</h2>
                <span className="text-[11px] text-muted-foreground">
                  {totalFindingsCount > 0
                    ? `${totalFindingsCount} item${totalFindingsCount > 1 ? "s" : ""}`
                    : "No findings yet"}
                </span>
              </div>

              {/* ✅ Slither error is now visible */}
              {slitherError && (
                <div className="mb-3 rounded-lg border border-amber-500/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Slither failed: {slitherError}
                </div>
              )}

              {!loading && staticFindings.length === 0 && aiFindings.length === 0 && (
                <p className="text-xs text-muted-foreground">No findings available.</p>
              )}

              {/* Slither findings */}
              {staticFindings.length > 0 && (
                <div className="mb-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Static analysis (Slither)
                  </div>

                  <div className="space-y-3">
                    {staticFindings.map((f, idx) => (
                      <FindingCard
                        key={`slither-${idx}`}
                        index={idx}
                        finding={{
                          severity: f.severity,
                          title: f.title,
                          description: f.where
                            ? `${f.description}\n\nWhere: ${f.where}`
                            : f.description,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* AI findings */}
              {aiFindings.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    AI-assisted findings
                  </div>

                  <div className="space-y-3">
                    {aiFindings.map((f, idx) => (
                      <FindingCard key={`ai-${idx}`} finding={f} index={idx} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ------------------- FINDING CARD --------------------- */

function FindingCard({ finding, index }: { finding: FindingCardModel; index: number }) {
  const sevMap: Record<string, string> = {
    critical: "bg-rose-100 text-rose-800 border border-rose-300",
    high: "bg-orange-100 text-orange-800 border border-orange-300",
    medium: "bg-amber-100 text-amber-800 border border-amber-300",
    low: "bg-emerald-100 text-emerald-800 border border-emerald-300",
    info: "bg-slate-100 text-slate-800 border border-slate-300",
  };

  const sevKey = (finding.severity || "medium").toLowerCase();
  const badgeStyle = sevMap[sevKey] ?? sevMap["medium"];

  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] text-muted-foreground">#{index + 1}</span>
            <span className="text-[13px] font-semibold">{finding.title}</span>
          </div>
          <p className="text-xs whitespace-pre-wrap">{finding.description}</p>
        </div>

        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeStyle}`}
        >
          {finding.severity}
        </span>
      </div>

      {finding.remediation && (
        <div className="mt-2 border-t border-border pt-2">
          <p className="text-[10px] font-semibold uppercase text-blue-600">
            Recommended remediation
          </p>
          <p className="text-[11px] leading-relaxed">{finding.remediation}</p>
        </div>
      )}
    </div>
  );
}
