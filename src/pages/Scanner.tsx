import { useState } from "react";
import { Shield, Loader2, AlertTriangle, UploadCloud, FileDown } from "lucide-react";
import { analyzeContract } from "@/utils/scannerPrompt";
import { useNavigate } from "react-router-dom";
import DashThemeToggle from "@/components/DashThemeToggle";

// PDF libraries
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Finding = {
  severity: "Critical" | "High" | "Medium" | "Low" | string;
  title: string;
  description: string;
  remediation?: string;
};

export default function ScannerPage() {
  const navigate = useNavigate();

  const [compiler, setCompiler] = useState("");
  const [sourceCode, setSourceCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [score, setScore] = useState<number | null>(null);
  const [summaryMd, setSummaryMd] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);

  const hasResults = score !== null || !!summaryMd || findings.length > 0;

  /* ------------------------ PDF EXPORT ------------------------ */
  const exportPDF = () => {
    if (!summaryMd && findings.length === 0) return;

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

    // Findings table
    if (findings.length > 0) {
      autoTable(doc, {
        startY: 60 + summaryLines.length * 5,
        head: [["Severity", "Title", "Description", "Remediation"]],
        body: findings.map((f) => [
          f.severity,
          f.title,
          f.description,
          f.remediation ?? "—",
        ]),
        styles: { fontSize: 9, cellWidth: "wrap" },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
          2: { cellWidth: 70 },
          3: { cellWidth: 50 },
        },
      });
    }

    doc.save("auditdapps_scan_report.pdf");
  };

  /* ------------------------ RUN SCAN ------------------------ */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const hasSource = !!sourceCode.trim();

    if (!hasSource) {
      setError("Paste or upload Solidity source before running a scan.");
      return;
    }

    setLoading(true);
    setScore(null);
    setSummaryMd(null);
    setFindings([]);

    try {
      const result = await analyzeContract({
        chain: "EVM",
        address: "N/A",
        sourceCode: sourceCode.trim(),
        compiler: compiler.trim() || null,
        contracts: [],
      });

      setScore(result.score);
      setSummaryMd(result.summary_md);
      setFindings(result.findings || []);
    } catch (err: unknown) {
      console.error("[ScannerPage] analyzeContract error:", err);
      setError("We couldn’t complete the scan. Try again shortly.");
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

  const canRunScan = !loading && sourceCode.trim().length > 0;

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
              <h1 className="text-2xl font-semibold tracking-tight">Smart Contract Scanner</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-xl">
                Upload or paste Solidity source code and generate an industry-style mini-audit with an
                executive summary, severity-based findings, and recommendations.
              </p>
            </div>
          </div>

          {/* RIGHT SIDE: Theme + Back */}
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
              Automated analysis only — always review critical code manually before deploy.
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
                <label htmlFor="compiler" className="block text-xs font-medium mb-1">Compiler version</label>
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
                  <label htmlFor="sourceCode" className="block text-xs font-medium">Solidity source</label>

                  <label htmlFor="upload" className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-1.5 text-[11px] cursor-pointer hover:bg-accent/40">
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span>Upload</span>
                    <input id="upload" type="file" accept=".sol,.txt,.json" className="hidden" onChange={handleFileUpload} />
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
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
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

                {/* EXPORT PDF BUTTON */}
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
                  The score is a high-level indicator. Combine this with manual review and threat modeling before deployment.
                </p>

                <div className={`relative h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold ${scoreTone}`}>
                  {score !== null ? score : "--"}
                  <span className="absolute text-[9px] uppercase bottom-2 opacity-75">score</span>
                </div>
              </div>

              {summaryMd && (
                <div className="mt-4 border-t border-border pt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 mb-2">
                    Executive summary
                  </div>
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">{summaryMd}</p>
                </div>
              )}
            </div>

            {/* FINDINGS */}
            <div className="rounded-2xl border border-border bg-card/90 backdrop-blur p-5 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold">Findings</h2>
                <span className="text-[11px] text-muted-foreground">
                  {findings.length ? `${findings.length} item${findings.length > 1 ? "s" : ""}` : "No findings yet"}
                </span>
              </div>

              {!findings.length && !loading && (
                <p className="text-xs text-muted-foreground">No findings available.</p>
              )}

              <div className="space-y-3">
                {findings.map((f, idx) => (
                  <FindingCard key={idx} finding={f} index={idx} />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ------------------- FINDING CARD --------------------- */

function FindingCard({ finding, index }: { finding: Finding; index: number }) {
  const sevMap = {
    critical: "bg-rose-100 text-rose-800 border border-rose-300",
    high: "bg-orange-100 text-orange-800 border border-orange-300",
    medium: "bg-amber-100 text-amber-800 border border-amber-300",
    low: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  };

  const sevKey = finding.severity.toLowerCase();
  const allowed = ["critical", "high", "medium", "low"] as const;
  type SevKey = (typeof allowed)[number];

  const key: SevKey = (allowed as readonly string[]).includes(sevKey)
    ? (sevKey as SevKey)
    : "medium";

  const badgeStyle = sevMap[key];


  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] text-muted-foreground">#{index + 1}</span>
            <span className="text-[13px] font-semibold">{finding.title}</span>
          </div>
          <p className="text-xs">{finding.description}</p>
        </div>

        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeStyle}`}>
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
