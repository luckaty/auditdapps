// src/pages/AuditDetail.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bar, Doughnut } from "react-chartjs-2";
import { motion } from "framer-motion";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  type ChartOptions,
  type ChartType,
  Legend,
  LinearScale,
  type Plugin,
  Tooltip,
} from "chart.js";
import { supabase } from "@/lib/supabaseClient";
import DashThemeToggle from "@/components/DashThemeToggle";
import { fromDbSeverity, fromDbStatus } from "@/lib/mappers";
import { computeRiskTotals, parseFindings, posturePercent } from "@/utils/riskUtils";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

/**
 * Augment Chart.js plugin options typing so we don't need @ts-expect-error
 * for our custom centerText plugin.
 */
declare module "chart.js" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    centerText?: { text?: string; color?: string };
  }
}

/* -------------------------- center text plugin -------------------------- */
const centerTextPlugin: Plugin<"doughnut"> = {
  id: "centerText",
  beforeDraw(chart) {
    const { ctx, width, height } = chart;
    const opts = chart.options.plugins?.centerText;
    const text = opts?.text ?? "";
    const color = opts?.color ?? "#0f172a";
    if (!text) return;

    ctx.save();
    const fontSize = Math.min(width, height) / 6;
    ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, width / 2, height / 2);
    ctx.restore();
  },
};

const SEVS = ["Critical", "High", "Medium", "Low"] as const;
type Sev = (typeof SEVS)[number];
type RecStatus = "open" | "partial" | "implemented";

type Finding = {
  key: string; // stable unique key for React rendering
  severity: Sev;
  mitigation: "none" | "partial" | "full";
  likelihood: string | null;
  text: string;
};

type RecommendationRow = {
  id: string;
  audit_id: string;
  title: string;
  severity: string | null;
  status: string | null;
} & Record<string, unknown>;

type RecNormalized = {
  id: string;
  audit_id: string;
  title: string;
  severity: Sev;
  status: RecStatus;
} & Record<string, unknown>;

type AnalyticsLike = {
  risk_score?: number | string | null;
  overallPct?: number | string | null;
};

type AuditRow = {
  id: string;
  created_at: string | null;
  score?: number | string | null;
  user_type?: string | null;
  meta?: {
    user_type?: string | null;
    analytics?: AnalyticsLike | null;
    [k: string]: unknown;
  } | null;
  analytics?: AnalyticsLike | null;
  baseline_findings?: Array<{
    severity?: string;
    mitigation?: string;
    text?: string;
    likelihood?: string;
    [k: string]: unknown;
  }>;
} & Record<string, unknown>;

/* ------------------------------ helpers ------------------------------ */
function normSev(s?: string): Sev {
  const v = String(s || "").toLowerCase();
  if (v === "critical") return "Critical";
  if (v === "high") return "High";
  if (v === "medium") return "Medium";
  if (v === "low") return "Low";
  return "Low";
}

function normMit(m?: string): "none" | "partial" | "full" {
  const v = String(m || "").toLowerCase();
  if (v === "full") return "full";
  if (v === "partial") return "partial";
  return "none";
}

function formatDate(ts?: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function capitalize(s: string) {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** Simple deterministic hash (sync) to build stable keys without array indexes. */
function hashString(input: string): string {
  let h = 2166136261; // FNV-1a seed
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/** Humanize Q-style text into declarative narrative. */
function humanizeFindingText(input: string, subject: string = "The organization"): string {
  let t = String(input || "").trim();
  t = t.replace(/^control\s+missing:\s*/i, "");
  t = t.replace(/^control\s+partially\s+implemented:\s*/i, () => "__PARTIAL__:");
  t = t.replace(/\?+$/g, "").replace(/\s*\.+\s*$/g, "").trim();
  t = t.replace(/^(if|for|when|in case|assuming)\s+[^,]+,\s*/i, "");

  const orgSubjects = [
    /^does\s+the\s+organization\s+/i,
    /^do\s+the\s+organization\s+/i,
    /^is\s+the\s+organization\s+/i,
    /^are\s+the\s+organization\s+/i,
    /^has\s+the\s+organization\s+/i,
    /^have\s+the\s+organization\s+/i,
  ];
  const genericSubjects = [
    /^does\s+your\s+organization\s+/i,
    /^does\s+the\s+project\s+/i,
    /^does\s+the\s+dapp\s+/i,
    /^is\s+there\s+/i,
    /^are\s+there\s+/i,
    /^do\s+you\s+/i,
  ];

  const startsWithOrg = orgSubjects.some((re) => re.test(t));
  const startsWithGeneric = genericSubjects.some((re) => re.test(t));

  if (startsWithOrg || startsWithGeneric) {
    t = t
      .replace(
        /^does\s+(the\s+organization|your\s+organization|the\s+project|the\s+dapp)\s+/i,
        `${subject} does not `
      )
      .replace(/^do\s+(the\s+organization|you)\s+/i, `${subject} does not `)
      .replace(/^is\s+(the\s+organization|there)\s+/i, `${subject} is not `)
      .replace(/^are\s+(the\s+organization|there)\s+/i, `${subject} is not `)
      .replace(/^has\s+(the\s+organization)\s+/i, `${subject} has not `)
      .replace(/^have\s+(the\s+organization)\s+/i, `${subject} has not `);
  } else if (/^no\s+/i.test(t)) {
    t = `${subject} does not have ` + t.replace(/^no\s+/i, "");
  } else if (/^lack\s+of\s+/i.test(t)) {
    t = `${subject} lacks ` + t.replace(/^lack\s+of\s+/i, "");
  } else if (/^__PARTIAL__:/i.test(t)) {
    t = t.replace(/^__PARTIAL__:\s*/i, "");
    t = t.replace(
      /^(does|do)\s+(the\s+organization|your\s+organization|the\s+project|the\s+dapp)\s+/i,
      ""
    );
    t = `${subject} has partially implemented ` + t.charAt(0).toLowerCase() + t.slice(1);
    return t.endsWith(".") ? t : t + ".";
  }

  if (/^are\s+/i.test(t)) {
    const m = t.match(/^are\s+(.+?)\s+(.*)$/i);
    if (m) {
      const subj = capitalize(m[1]);
      const rest = m[2].trim();
      t = `${subj} are not ${rest}`;
    }
  } else if (/^is\s+/i.test(t)) {
    const m = t.match(/^is\s+(.+?)\s+(.*)$/i);
    if (m) {
      const subj = capitalize(m[1]);
      const rest = m[2].trim();
      t = `${subj} is not ${rest}`;
    } else {
      const broad = t.match(/^is\s+the\s+(scope|project|system|protocol)\s+(.+)/i);
      if (broad) t = `${subject} has not clearly defined the ${broad[1]} ${broad[2]}`;
    }
  }

  if (/^(use|enable|enforce|implement|maintain|have|run|perform|conduct)\b/i.test(t)) {
    t = `${subject} does not ` + t.toLowerCase();
  }

  t = t.replace(/\s+/g, " ").trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!)]$/.test(t)) t += ".";
  return t;
}

function cleanRecTitle(raw: string): string {
  let t = (raw || "").trim();
  t = t.replace(/^implement:\s*/i, "");
  const mapParticiple: Record<string, string> = {
    configured: "Configure",
    implemented: "Implement",
    monitored: "Monitor",
    retained: "Retain",
    documented: "Document",
    protected: "Protect",
    separated: "Separate",
    tested: "Test",
    addressed: "Address",
    enforced: "Enforce",
  };

  let m = t.match(
    /^are\s+(.+?)\s+(configured|implemented|monitored|retained|documented|protected|separated|tested|addressed|enforced)\b(.*)$/i
  );
  if (m) {
    const subj = m[1].trim();
    const verb = mapParticiple[m[2].toLowerCase()] || "Implement";
    const rest = (m[3] || "").trim();
    return `${verb} ${subj}${rest ? " " + rest : ""}`.replace(/\?+$/g, "").trim();
  }

  m = t.match(
    /^is\s+(.+?)\s+(configured|implemented|monitored|retained|documented|protected|separated|tested|addressed|enforced)\b(.*)$/i
  );
  if (m) {
    const subj = m[1].trim();
    const verb = mapParticiple[m[2].toLowerCase()] || "Implement";
    const rest = (m[3] || "").trim();
    return `${verb} ${subj}${rest ? " " + rest : ""}`.replace(/\?+$/g, "").trim();
  }

  m = t.match(/^(does|do)\s+(the\s+organization|your\s+organization|the\s+project|the\s+dapp|it|you)\s+have\s+(.+)$/i);
  if (m) return `Establish ${m[3].trim()}`.replace(/\?+$/g, "").trim();

  return t.replace(/\?+$/g, "").trim();
}

/* ------------------------------- UI shells ------------------------------ */
function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-[11px] font-medium align-middle whitespace-nowrap ${className}`}
      style={{ height: 24, padding: "0 12px", boxSizing: "border-box" }}
    >
      {children}
    </span>
  );
}

function MotionCard({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      className={`relative rounded-2xl border bg-card border-border shadow-sm p-5 md:p-6 lg:p-7 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mb-4 md:mb-5 lg:mb-6 font-semibold text-foreground">{title}</div>
      {children}
    </motion.div>
  );
}

/* ====================================================================== */

export default function AuditDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? null;
  const navigate = useNavigate();

  const [audit, setAudit] = useState<AuditRow | null>(null);
  const [recs, setRecs] = useState<RecNormalized[]>([]);
  const [md, setMd] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // certificate request modal state
  const [showCertModal, setShowCertModal] = useState(false);
  const [certRepo, setCertRepo] = useState("");
  const [certProject, setCertProject] = useState("");
  const [certAgree, setCertAgree] = useState(false);
  const [certLoading, setCertLoading] = useState(false);
  const [certDone, setCertDone] = useState(false);

  // two-page PDF containers
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);

  // dark-aware colors for charts
  const theme = useMemo(() => {
    const isDark = document.documentElement.classList.contains("dark");
    return {
      text: isDark ? "#e2e8f0" : "#0f172a",
      subtext: isDark ? "#94a3b8" : "#475569",
      grid: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      donutColors: ["#ef4444", "#f59e0b", "#10b981"],
      barNone: "#ef4444",
      barPartial: "#f59e0b",
      barFull: "#10b981",
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data: a, error: auditErr } = await supabase
        .from("audits")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      const { data: r, error: recErr } = await supabase
        .from("recommendations")
        .select("*")
        .eq("audit_id", id);

      if (!mounted) return;

      if (auditErr) console.error("Failed to load audit", auditErr);
      if (recErr) console.error("Failed to load recommendations", recErr);

      const recRows = (r ?? []) as unknown as RecommendationRow[];
      const normalized: RecNormalized[] = recRows.map((x) => ({
        ...x,
        severity: fromDbSeverity(x.severity ?? undefined) as Sev,
        status: fromDbStatus(x.status ?? undefined) as RecStatus,
      }));

      setAudit((a as unknown as AuditRow) ?? null);
      setRecs(normalized);
      setMd(localStorage.getItem("audit_recommendations") || "");
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  // subject for narrative
  const subject: string = useMemo(() => {
    const t = (audit?.user_type || audit?.meta?.user_type || "").toString().toLowerCase();
    if (t === "developer" || t === "dev") return "The developer";
    return "The organization";
  }, [audit]);

  /* ------------------------------- score ------------------------------- */
  const summaryFromDb =
    (audit?.meta?.analytics as unknown as { summary_md?: string; summary?: string } | null)?.summary_md ||
    (audit?.analytics as unknown as { summary_md?: string; summary?: string } | null)?.summary_md ||
    (audit?.meta?.analytics as unknown as { summary_md?: string; summary?: string } | null)?.summary ||
    (audit?.analytics as unknown as { summary_md?: string; summary?: string } | null)?.summary ||
    null;

  const fullNarrative: string = summaryFromDb || md || "";

  const narrativeIntro = useMemo(() => {
    if (!fullNarrative) return "";
    const parts = fullNarrative.split(/\n\s*\n/);
    return (parts[0] || "").trim();
  }, [fullNarrative]);

  function postureFromAnalytics(analytics: AnalyticsLike | null | undefined): number | null {
    if (!analytics) return null;

    const risk =
      typeof analytics.risk_score === "string" ? parseFloat(analytics.risk_score) : analytics.risk_score;

    if (Number.isFinite(risk)) return Math.round(risk as number);

    const overall =
      typeof analytics.overallPct === "string" ? parseFloat(analytics.overallPct) : analytics.overallPct;

    if (Number.isFinite(overall)) return Math.max(0, Math.min(100, 100 - Math.round(overall as number)));

    return null;
  }

  const findings: Finding[] = useMemo(() => {
    const raw = (audit?.baseline_findings ?? []) as Array<{
      severity?: string;
      mitigation?: string;
      text?: string;
      likelihood?: string;
    }>;

    const occurrences = new Map<string, number>();

    return raw.map((f) => {
      const severity = normSev(f.severity);
      const mitigation = normMit(f.mitigation);
      const likelihood = f.likelihood ?? null;
      const text = f.text ?? "";

      const signature = `${severity}|${mitigation}|${likelihood ?? ""}|${text}`;
      const base = hashString(signature);
      const prevCount = occurrences.get(base) ?? 0;
      occurrences.set(base, prevCount + 1);

      // stable + unique even when duplicates exist
      const key = `${base}-${prevCount + 1}`;

      return { key, severity, mitigation, likelihood, text };
    });
  }, [audit]);

  // Keep these casts "any-free" while remaining compatible with your utils typing.
  const baselineTotals = useMemo(() => {
    type TotalsArg = Parameters<typeof computeRiskTotals>[0];
    return computeRiskTotals(findings as unknown as TotalsArg);
  }, [findings]);

  const baselineScore = useMemo(() => posturePercent(baselineTotals), [baselineTotals]);

  const mdFallbackScore = useMemo(() => {
    if (!fullNarrative) return null;
    const parsed = parseFindings(fullNarrative);
    const totals = computeRiskTotals(parsed);
    return posturePercent(totals);
  }, [fullNarrative]);

  const rawScore =
    baselineScore ??
    postureFromAnalytics(audit?.meta?.analytics) ??
    postureFromAnalytics(audit?.analytics) ??
    (Number.isFinite(audit?.score) ? Number(audit?.score) : null) ??
    mdFallbackScore ??
    0;

  const score = Math.round(Number(rawScore) || 0);

  /* ----------------------------- counts/groups ---------------------------- */
  const sevCounts = useMemo(() => {
    const out: Record<Sev, number> = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    };
    for (const f of findings) out[f.severity] = (out[f.severity] ?? 0) + 1;
    return out;
  }, [findings]);

  const grouped = useMemo(() => {
    const g: Record<Sev, Finding[]> = {
      Critical: [],
      High: [],
      Medium: [],
      Low: [],
    };
    for (const f of findings) g[f.severity].push(f);
    return g;
  }, [findings]);

  /* ------------------------------- donut ------------------------------- */
  const donutData = useMemo(() => {
    const red = (sevCounts.High ?? 0) + (sevCounts.Critical ?? 0);
    return {
      labels: ["High", "Medium", "Low"],
      datasets: [
        {
          data: [red, sevCounts.Medium ?? 0, sevCounts.Low ?? 0],
          backgroundColor: theme.donutColors,
          borderWidth: 0,
        },
      ],
    };
  }, [sevCounts, theme]);

  const donutOptions = useMemo<ChartOptions<"doughnut">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: theme.text },
        },
        centerText: { text: `${score}%`, color: theme.text },
        tooltip: {
          titleColor: theme.text,
          bodyColor: theme.text,
        },
      },
    }),
    [score, theme]
  );

  /* ------------------------------- bar ------------------------------- */
  const barData = useMemo(() => {
    const mitCounts = (SEVS as readonly Sev[]).reduce((acc, sev) => {
      acc[sev] = { none: 0, partial: 0, full: 0 };
      return acc;
    }, {} as Record<Sev, { none: number; partial: number; full: number }>);

    for (const f of findings) {
      const sev: Sev = SEVS.includes(f.severity) ? f.severity : "Low";
      const bucket = f.mitigation;
      mitCounts[sev][bucket]++;
    }

    return {
      labels: SEVS as unknown as string[],
      datasets: [
        { label: "None", data: SEVS.map((s) => mitCounts[s].none), backgroundColor: theme.barNone },
        { label: "Partial", data: SEVS.map((s) => mitCounts[s].partial), backgroundColor: theme.barPartial },
        { label: "Full", data: SEVS.map((s) => mitCounts[s].full), backgroundColor: theme.barFull },
      ],
    };
  }, [findings, theme]);

  const barOptions = useMemo<ChartOptions<"bar">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: theme.text },
        },
      },
      scales: {
        x: { stacked: true, ticks: { color: theme.subtext }, grid: { color: theme.grid } },
        y: { stacked: true, beginAtZero: true, ticks: { color: theme.subtext }, grid: { color: theme.grid } },
      },
    }),
    [theme]
  );

  const barKey = useMemo(() => {
    const sums = SEVS.map((sev) => {
      const counts = findings.reduce(
        (acc, f) => {
          if (f.severity === sev) {
            if (f.mitigation === "full") acc.full++;
            else if (f.mitigation === "partial") acc.partial++;
            else acc.none++;
          }
          return acc;
        },
        { none: 0, partial: 0, full: 0 }
      );
      return `${counts.none}-${counts.partial}-${counts.full}`;
    }).join("|");
    return `bar-${id ?? "noid"}-${sums}`;
  }, [findings, id]);

  /* ------------------------- Update recommendation ------------------------- */
  async function updateRecStatus(recId: string, newStatus: RecStatus) {
    setSavingId(recId);
    const prev = recs;

    setRecs((p) => p.map((r) => (r.id === recId ? { ...r, status: newStatus } : r)));

    const { error } = await supabase.from("recommendations").update({ status: newStatus }).eq("id", recId);

    setSavingId(null);

    if (error) {
      console.error("Failed to update rec status", error);
      setRecs(prev);
      alert("Failed to update status. Please try again.");
    }
  }

  const allImplemented = useMemo(() => recs.length > 0 && recs.every((r) => r.status === "implemented"), [recs]);

  function resetCertModal() {
    setShowCertModal(false);
    setCertRepo("");
    setCertProject("");
    setCertAgree(false);
    setCertLoading(false);
    setCertDone(false);
  }

  /* -------------------------------- render ------------------------------ */
  if (!id) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-muted-foreground">
        Invalid audit id.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-muted-foreground">
        Loading audit…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top controls with theme toggle */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 lg:px-8 pt-6 md:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Audit Detail</h1>
            <p className="text-sm text-muted-foreground">{formatDate(audit?.created_at ?? null)}</p>
          </div>
          <div className="flex items-center gap-2">
            <DashThemeToggle />
            {allImplemented && (
              <button
                onClick={() => {
                  setShowCertModal(true);
                  setCertDone(false);
                }}
                className="px-4 py-2 rounded bg-primary text-primary-foreground hover:opacity-90"
              >
                Request Certificate
              </button>
            )}

            <button
              onClick={async () => {
                const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
                  import("html2canvas"),
                  import("jspdf"),
                ]);

                const p1 = page1Ref.current;
                const p2 = page2Ref.current;
                if (!p1) return;

                const page1Canvas = await html2canvas(p1, {
                  scale: 2,
                  backgroundColor: "#ffffff",
                  useCORS: true,
                  scrollY: -window.scrollY,
                });
                const page1Img = page1Canvas.toDataURL("image/png");

                const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const margin = 36;
                const usableWidth = pageWidth - margin * 2;

                const paintHeaderFooter = (pageNum: number) => {
                  const title = "AuditDapps Security Report";
                  const dateStr = formatDate(audit?.created_at ?? null);

                  pdf.setFont("helvetica", "bold");
                  pdf.setFontSize(12);
                  pdf.setTextColor("#0f172a");
                  pdf.text(title, margin, margin - 12);

                  pdf.setFont("helvetica", "normal");
                  pdf.setFontSize(10);
                  pdf.setTextColor("#475569");
                  pdf.text(`Date: ${dateStr}  •  Audit ID: ${id}`, margin, margin + 2);

                  pdf.setFontSize(9);
                  pdf.setTextColor("#94a3b8");
                  pdf.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - margin / 2, { align: "right" });
                };

                paintHeaderFooter(1);

                const p1Height = (page1Canvas.height * usableWidth) / page1Canvas.width;
                pdf.addImage(page1Img, "PNG", margin, margin + 10, usableWidth, p1Height);

                if (p2) {
                  const page2Canvas = await html2canvas(p2, {
                    scale: 2,
                    backgroundColor: "#ffffff",
                    useCORS: true,
                    scrollY: -window.scrollY,
                  });
                  const page2Img = page2Canvas.toDataURL("image/png");
                  const p2Height = (page2Canvas.height * usableWidth) / page2Canvas.width;

                  pdf.addPage();
                  paintHeaderFooter(2);

                  let rendered = 0;
                  while (rendered < p2Height) {
                    const y = margin + 10 - rendered;
                    pdf.addImage(page2Img, "PNG", margin, y, usableWidth, p2Height);
                    rendered += pageHeight - margin * 2;
                    if (rendered < p2Height) {
                      pdf.addPage();
                      paintHeaderFooter(pdf.getNumberOfPages());
                    }
                  }
                }

                pdf.save(`audit-${id}.pdf`);
              }}
              className="px-3 py-1 rounded-full text-sm border border-border bg-card text-foreground hover:bg-accent/60"
              title="Export this report as PDF"
            >
              ⬇️ Export PDF
            </button>

            <button
              onClick={() => navigate("/dashboard")}
              className="px-3 py-1 rounded-full text-sm border border-border bg-card text-foreground hover:bg-accent/60"
            >
              ← Back to dashboard
            </button>
          </div>
        </div>
      </div>

      {/* ======= PAGE 1 (exported) ======= */}
      <div
        id="reportPage1"
        ref={page1Ref}
        className="max-w-screen-xl mx-auto px-4 md:px-6 lg:px-8 pb-6 md:pb-8 space-y-6 md:space-y-8"
      >
        {/* Printable header inside the report */}
        <div className="border rounded-2xl p-5 md:p-6 lg:p-7 border-border bg-card">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">AuditDapps</div>
              <h2 className="text-xl md:text-2xl font-semibold">Security Report</h2>
              <div className="text-sm text-muted-foreground">
                Date: {formatDate(audit?.created_at ?? null)} • Audit ID: {id}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Overall Score</div>
              <div className="text-3xl font-bold">{score}%</div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <MotionCard title="🌟 Overall Security Score" className="lg:col-span-1">
            <div className="h-[15rem] md:h-[18rem] lg:h-[19rem]">
              <Doughnut
                key={`donut-${score}`}
                data={donutData}
                options={donutOptions}
                plugins={[centerTextPlugin]}
              />
            </div>
            <div className="mt-5 text-xs md:text-sm text-muted-foreground space-y-1.5">
              <p>
                This chart summarizes your overall <strong>security score</strong> (0–100), calculated with weighted
                severity levels. <em>Higher is better.</em>
              </p>
              <p>
                <strong>Scoring:</strong> Critical &amp; High findings carry more weight. Full mitigation{" "}
                <strong>increases</strong> the score; no mitigation <strong>decreases</strong> it.
              </p>
              <p>
                <strong>Interpretation:</strong> Aim for <strong>80%+</strong>. <strong>60–79%</strong> needs
                improvement; <strong>below 60%</strong> indicates elevated risk.
              </p>
            </div>
          </MotionCard>

          {/* Bar */}
          <MotionCard title="⚖️ Mitigation by Severity" className="lg:col-span-2">
            <div className="h-[15rem] md:h-[18rem] lg:h-[19rem]">
              <Bar key={barKey} data={barData} options={barOptions} />
            </div>
            <div className="mt-5 text-xs md:text-sm text-muted-foreground space-y-1.5">
              <p>This chart breaks down how issues by severity are currently mitigated (from baseline findings):</p>
              <ul className="list-disc list-inside">
                <li>
                  <strong>None</strong>: Issue not addressed at all
                </li>
                <li>
                  <strong>Partial</strong>: Some effort has been made, but it’s incomplete
                </li>
                <li>
                  <strong>Full</strong>: Issue is completely resolved or mitigated
                </li>
              </ul>
              <p>This visual helps prioritize action. For example, critical issues with &quot;None&quot; status are urgent.</p>
            </div>
          </MotionCard>
        </div>

        {/* Summary */}
        <MotionCard title="🧾 Audit Summary">
          <div className="mb-4 text-sm">
            <div className="font-medium mb-1">Findings snapshot (deterministic)</div>
            <div className="flex flex-wrap gap-2">
              <Pill className="bg-rose-200/20 text-rose-400 border border-rose-400/30">
                Critical: {sevCounts.Critical}
              </Pill>
              <Pill className="bg-orange-200/20 text-orange-400 border border-orange-400/30">
                High: {sevCounts.High}
              </Pill>
              <Pill className="bg-amber-200/20 text-amber-400 border border-amber-400/30">
                Medium: {sevCounts.Medium}
              </Pill>
              <Pill className="bg-emerald-200/20 text-emerald-400 border border-emerald-400/30">
                Low: {sevCounts.Low}
              </Pill>
            </div>
          </div>

          {narrativeIntro && (
            <div className="prose prose-invert prose-sm md:prose-base max-w-none mb-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{narrativeIntro}</ReactMarkdown>
            </div>
          )}

          <div className="space-y-6">
            {SEVS.map((sev) => (
              <div key={sev}>
                <div className="flex items-center gap-2 mb-2">
                  {sev === "Critical" && <span className="text-rose-400 text-lg">🔴</span>}
                  {sev === "High" && <span className="text-orange-400 text-lg">🎯</span>}
                  {sev === "Medium" && <span className="text-amber-400 text-lg">⚠️</span>}
                  {sev === "Low" && <span className="text-emerald-400 text-lg">🟡</span>}
                  <h3 className="text-lg font-semibold">{sev} Severity</h3>
                </div>

                {grouped[sev].length ? (
                  <ul className="space-y-2">
                    {grouped[sev].map((f) => (
                      <li key={f.key} className="flex items-start gap-2">
                        <span
                          className={`mt-[6px] inline-block w-2 h-2 rounded-full ${
                            sev === "Critical"
                              ? "bg-rose-400"
                              : sev === "High"
                              ? "bg-orange-400"
                              : sev === "Medium"
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                          }`}
                        />
                        <span className="text-sm text-muted-foreground">
                          {humanizeFindingText(f.text, subject)}
                          {f.likelihood ? ` [Likelihood: ${f.likelihood}]` : ""}
                          {` [Mitigation: ${f.mitigation.charAt(0).toUpperCase() + f.mitigation.slice(1)}]`}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No {sev.toLowerCase()} findings.</p>
                )}
              </div>
            ))}
          </div>
        </MotionCard>
      </div>

      {/* ======= PAGE 2 (exported) — Tailored Recommendations only ======= */}
      <div
        id="reportPage2"
        ref={page2Ref}
        className="max-w-screen-xl mx-auto px-4 md:px-6 lg:px-8 pb-8"
      >
        <MotionCard title="🛠️ Tailored Actionable Recommendations">
          {recs.length ? (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground">
                    <th className="text-left py-2 px-3">Severity</th>
                    <th className="text-left py-2 px-3">Recommendation</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...recs]
                    .sort((a, b) => {
                      const order: Record<Sev, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
                      return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
                    })
                    .map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="py-2 px-3">
                          <Pill
                            className={
                              r.severity === "Critical"
                                ? "bg-rose-200/20 text-rose-400 border border-rose-400/30"
                                : r.severity === "High"
                                ? "bg-orange-200/20 text-orange-400 border border-orange-400/30"
                                : r.severity === "Medium"
                                ? "bg-amber-200/20 text-amber-400 border border-amber-400/30"
                                : "bg-emerald-200/20 text-emerald-400 border border-emerald-400/30"
                            }
                          >
                            {r.severity}
                          </Pill>
                        </td>

                        <td className="py-2 px-3">{cleanRecTitle(r.title)}</td>

                        <td className="py-2 px-3 capitalize">
                          <span
                            className={`inline-flex items-center justify-center rounded-full text-[11px] px-2 h-6 border ${
                              r.status === "implemented"
                                ? "bg-emerald-200/20 text-emerald-400 border-emerald-400/30"
                                : r.status === "partial"
                                ? "bg-amber-200/20 text-amber-400 border-amber-400/30"
                                : "bg-muted text-foreground/80 border-border"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>

                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={r.status}
                              disabled={savingId === r.id}
                              onChange={(e) => updateRecStatus(r.id, e.target.value as RecStatus)}
                              className="rounded border border-border bg-card text-sm px-2 py-1"
                            >
                              <option value="open">Open</option>
                              <option value="partial">Partial</option>
                              <option value="implemented">Implemented</option>
                            </select>

                            {r.status !== "implemented" && (
                              <button
                                disabled={savingId === r.id}
                                onClick={() => updateRecStatus(r.id, "implemented")}
                                className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:opacity-90 disabled:opacity-60"
                                title="Mark as Implemented"
                              >
                                Mark implemented
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tailored recommendations available.</p>
          )}

          <div className="mt-4 text-xs text-muted-foreground">
            {allImplemented
              ? "✅ All recommendations are marked Implemented. You can now request your certificate using the button at the top of this page."
              : "Complete all recommendations to unlock the certificate request."}
          </div>
        </MotionCard>
      </div>

      {/* ===== Certificate Request Modal ===== */}
      {showCertModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Request Certificate</h2>
              <button className="text-muted-foreground hover:text-foreground" onClick={resetCertModal}>
                ✕
              </button>
            </div>

            {certDone ? (
              <div className="text-center space-y-4 py-6">
                <div className="text-3xl">🎉</div>
                <h3 className="text-xl font-semibold">Request Submitted</h3>
                <p className="text-muted-foreground text-sm">
                  Thank you! Our team will now review your implementation work. Once verified, your audit certificate
                  will be issued to you via email.
                </p>
                <button onClick={resetCertModal} className="mt-4 px-4 py-2 rounded bg-primary text-primary-foreground">
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="certProject" className="block text-sm mb-1">
                        Project Name
                      </label>
                      <input
                        id="certProject"
                        className="w-full rounded border border-border bg-card px-3 py-2 text-sm"
                        value={certProject}
                        onChange={(e) => setCertProject(e.target.value)}
                        placeholder="e.g. MyDapp Protocol"
                      />
                    </div>

                    <div>
                      <label htmlFor="certRepo" className="block text-sm mb-1">
                        Repository URL
                      </label>
                      <input
                        id="certRepo"
                        className="w-full rounded border border-border bg-card px-3 py-2 text-sm"
                        value={certRepo}
                        onChange={(e) => setCertRepo(e.target.value)}
                        placeholder="https://github.com/user/project"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={certAgree}
                      onChange={(e) => setCertAgree(e.target.checked)}
                      className="mt-1"
                    />
                    <span>I confirm that all recommendations have been fully implemented.</span>
                  </label>
                </div>

                <button
                  disabled={!certRepo || !certProject || !certAgree || certLoading}
                  onClick={async () => {
                    try {
                      setCertLoading(true);

                      const { data, error: userError } = await supabase.auth.getUser();
                      const user = data?.user;

                      if (userError || !user) {
                        setCertLoading(false);
                        alert("You need to be logged in to request a certificate.");
                        return;
                      }

                      const { error } = await supabase.functions.invoke("send-certificate-request", {
                        body: {
                          project: certProject,
                          repo: certRepo,
                          user_id: user.id,
                          email: user.email,
                          audit_id: id,
                        },
                      });

                      setCertLoading(false);

                      if (error) {
                        console.error("Certificate request failed", error);
                        alert("Something went wrong. Please try again.");
                      } else {
                        setCertDone(true);
                      }
                    } catch (err: unknown) {
                      console.error(err);
                      setCertLoading(false);
                      alert("Something went wrong. Please try again.");
                    }
                  }}
                  className="w-full py-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {certLoading ? "Submitting..." : "Submit Certificate Request"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
