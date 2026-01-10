//src/pages/Dashboard.tsx
import { useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import DashThemeToggle from "../components/DashThemeToggle";
import FeedbackWidget from "../components/Feedback/FeedbackWidget";

// DB <-> UI mappers
import { fromDbSeverity, fromDbStatus, toDbStatus } from "@/lib/mappers";

/* ===================== types ===================== */
type Plan = "free" | "one-time" | "premium";

type Profile = {
  id?: string;
  email?: string | null;
  is_premium?: boolean | null;
  one_time_access?: boolean | null;
  premium_expires_at?: string | null;
};

type Counts = Partial<{ critical: number; high: number; medium: number; low: number }>;

type Audit = {
  id: string;
  user_id?: string;
  created_at: string | null;
  user_type: string;
  status: string | null;
  counts: Counts | null;
  score: number | null;
  meta?: any;
  analytics?: any;
};

type Severity = "Critical" | "High" | "Medium" | "Low" | string;
type RecStatus = "open" | "implemented" | string;

type Recommendation = {
  id: string;
  audit_id: string;
  title: string;
  severity: Severity;
  status: RecStatus;
};

type DashboardData = {
  profile?: Profile | null;
  audits?: Audit[];
  recommendations?: Recommendation[];
};

/* ===================== config ===================== */
const HARD_BLOCK_NEW_AUDIT = false;

/* ===================== helpers ===================== */
function computeScoreFromCounts(counts: Counts | null | undefined) {
  const c = counts ?? {};
  const critical = c.critical ?? 0;
  const high = c.high ?? 0;
  const medium = c.medium ?? 0;
  const low = c.low ?? 0;
  const raw = 100 - 40 * critical - 20 * high - 10 * medium - 5 * low;
  const clamped = Math.max(0, Math.min(100, raw));
  return Math.round(clamped);
}

function pickNumber(...vals: any[]): number | null {
  for (const v of vals) {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (Number.isFinite(n)) return n as number;
  }
  return null;
}

// Clean titles: remove leading emoji and trailing tags
function cleanTitle(s: string): string {
  const str = String(s ?? "");
  const withoutTags = str
    .replace(/\s*\[\s*likelihood\s*:[^\]]+\]\s*\[\s*mitigation\s*:[^\]]+\]\s*$/i, "")
    .trim();
  return withoutTags.replace(/^[\p{Extended_Pictographic}\s]+/u, "").trim();
}

function startsWithEmoji(s: string): boolean {
  return /^[\p{Extended_Pictographic}]/u.test(String(s ?? ""));
}

// Present recommendations as actionable tasks (for older rows too)
function actionizeForDisplay(s: string) {
  let t = (s || "").trim();
  t = t.replace(/^control (missing|partially implemented):\s*/i, "");
  if (!/^(implement|enable|ensure|establish|add|deploy|configure|harden|document)\b/i.test(t)) {
    t = t.replace(/\?+$/, "");
    t = `Implement: ${t}`;
  }
  return t;
}

// 🔐 Small guard to avoid any accidental duplicates
function dedupeById<T extends { id: string }>(items: T[] | null | undefined): T[] {
  if (!items || !items.length) return [];
  const map = new Map<string, T>();
  for (const item of items) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

/* ===================== page ===================== */
export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // mobile drawer
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  // lock body scroll on drawer
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // ESC closes drawer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // boot: profile + audits + recommendations (latest only)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id ?? null;

        const { data: profile } = userId
          ? await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()
          : ({ data: null as Profile | null } as any);

        // include top-level analytics for legacy rows
        const audits: Audit[] = userId
          ? (
              await supabase
                .from("audits")
                .select("id, created_at, user_type, status, counts, score, user_id, meta, analytics")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
            ).data?.map((a: any) => ({
              id: a.id,
              created_at: a.created_at ?? null,
              user_type: a.user_type,
              status: a.status,
              counts: (a.counts ?? null) as Counts | null,
              score: a.score ?? null,
              user_id: a.user_id,
              meta: a.meta ?? null,
              analytics: a.analytics ?? null,
            })) ?? []
          : [];

        const dedupedAudits = dedupeById(audits);

        // recommendations from latest audit only
        let latestRecs: Recommendation[] = [];
        if (dedupedAudits[0]?.id) {
          const { data: recsRaw } = await supabase
            .from("recommendations")
            .select("id, audit_id, title, severity, status")
            .eq("audit_id", dedupedAudits[0].id);

          latestRecs =
            (recsRaw ?? []).map((r: any) => ({
              id: r.id,
              audit_id: r.audit_id,
              title: r.title,
              severity: fromDbSeverity(r.severity),
              status: fromDbStatus(r.status),
            })) ?? [];
        }

        const dedupedRecs = dedupeById(latestRecs);

        if (!mounted) return;
        setData({
          profile: profile ?? { email: auth.user?.email ?? null },
          audits: dedupedAudits,
          recommendations: dedupedRecs,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const { profile, audits = [], recommendations = [] } = data ?? {};
  const latest = audits[0];

  // ✅ Prefer top-level score; then meta.analytics.score; ...
  const latestScore = useMemo(() => {
    const n = pickNumber(
      latest?.score,
      latest?.meta?.analytics?.score,
      latest?.meta?.analytics?.risk_score,
      latest?.analytics?.score,
      latest?.analytics?.risk_score,
      latest?.meta?.analytics?.overallPct != null ? 100 - Number(latest.meta.analytics.overallPct) : null,
      latest?.analytics?.overallPct != null ? 100 - Number(latest.analytics.overallPct) : null
    );
    return n !== null ? Math.round(n) : computeScoreFromCounts(latest?.counts);
  }, [latest]);

  const counts: Counts = latest?.counts ?? { critical: 0, high: 0, medium: 0, low: 0 };

  // 🔓 Premium detection (from DB). This drives the sidebar locks + upgrade button.
  const plan: Plan = profile?.is_premium ? "premium" : profile?.one_time_access ? "one-time" : "free";

  // certificate unlock = all latest recs implemented (or none exist)
  const allImplemented = useMemo(
    () =>
      recommendations.length
        ? recommendations.every((r) => String(r.status).toLowerCase() === "implemented")
        : true,
    [recommendations]
  );

  // flag audit as completed + unlock cert (best-effort)
  const [didFlagCert, setDidFlagCert] = useState(false);
  useEffect(() => {
    if (!latest?.id) return;
    if (!allImplemented || didFlagCert) return;
    (async () => {
      try {
        await supabase
          .from("audits")
          .update({ status: "completed", certificate_unlocked: true })
          .eq("id", latest.id);
      } catch {
        /* non-fatal */
      } finally {
        setDidFlagCert(true);
      }
    })();
  }, [allImplemented, latest?.id, didFlagCert]);

  /* ===================== rec toggle (open <-> implemented) ===================== */
  const onToggleStatus = async (recId: string, nextStatus: RecStatus) => {
    try {
      setToggling(recId);
      setData((prev) =>
        !prev?.recommendations
          ? prev
          : {
              ...prev,
              recommendations: prev.recommendations.map((r) =>
                r.id === recId ? { ...r, status: nextStatus } : r
              ),
            }
      );
      const dbStatus = toDbStatus(nextStatus);
      const { error } = await supabase
        .from("recommendations")
        .update({ status: dbStatus })
        .eq("id", recId);
      if (error) throw error;
    } finally {
      setToggling(null);
    }
  };

  /* ===================== start-audit guard ===================== */
  const onStartAudit = () => {
    if (HARD_BLOCK_NEW_AUDIT && !allImplemented) {
      alert(
        "Finish implementing all recommendations and download your certificate before starting a new audit."
      );
      return;
    }
    if (!allImplemented) {
      const ok = window.confirm(
        "You still have unimplemented recommendations from your last audit. Start a new audit anyway?"
      );
      if (!ok) return;
    }
    navigate("/self-audit");
  };

  /* ===================== loading ===================== */
  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center bg-background text-foreground">
        <div className="text-muted-foreground text-sm">Loading your dashboard…</div>
      </div>
    );
  }

  /* ===================== UI ===================== */
  const top5 = audits.slice(0, 5);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-[10px] pt-[calc(10px+env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-card shadow-sm hover:bg-accent/60 active:scale-[.98] transition md:hidden"
                aria-label="Open menu"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                  <path
                    d="M4 6h16M4 12h16M4 18h16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Middle: small status */}
            <div className="hidden md:flex min-w-0 flex-1 px-3 items-center gap-3">
              <div className="text-sm text-muted-foreground truncate">
                Here’s what’s happening with your security posture.
              </div>
            </div>

            {/* RIGHT ACTIONS */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Plan pill always visible */}
              <span
                className="hidden sm:inline-flex items-center h-9 px-3 rounded-full border border-border bg-card text-xs capitalize"
                title="Your current plan"
              >
                Plan: <span className="ml-1 font-semibold">{plan}</span>
              </span>

              <DashThemeToggle />

              {/* Upgrade only for FREE plan */}
              {plan === "free" && (
                <a
                  href="/auth/payment"
                  className="px-3 h-9 inline-flex items-center rounded-full border border-border bg-card shadow-sm text-sm hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Upgrade
                </a>
              )}

              <div
                className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white grid place-items-center font-semibold"
                title={profile?.email ?? ""}
              >
                {profile?.email?.[0]?.toUpperCase() ?? "U"}
              </div>
            </div>
          </div>

          {/* Mobile greeting + plan */}
          <div className="md:hidden mt-2 text-[15px] font-semibold">
            Welcome back{profile?.email ? `, ${profile.email}` : ""}
          </div>
          <div className="md:hidden text-muted-foreground text-sm flex items-center gap-2">
            <span className="capitalize">
              Plan: <span className="font-medium text-foreground">{plan}</span>
            </span>
            {plan === "free" && (
              <a href="/auth/payment" className="ml-2 underline">
                Upgrade
              </a>
            )}
          </div>
          <div className="md:hidden text-muted-foreground text-sm">
            {plan === "free"
              ? "Upgrade to view full recommendations and unlock your certificate."
              : allImplemented
              ? "All recommendations implemented — your certificate is unlocked."
              : "Implement all recommendations to unlock your certificate."}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            className="fixed z-50 inset-y-0 left-0 w-[85vw] max-w-[320px] bg-background border-r border-border shadow-2xl rounded-r-2xl p-4 pt-[calc(16px+env(safe-area-inset-top))] translate-x-0 transition-transform"
          >
            <div className="flex items-center justify-between">
              <div className="text-xl font-extrabold tracking-tight">
                Audit<span className="text-blue-600">Dapps</span>
              </div>
              <button
                ref={closeBtnRef}
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-card shadow-sm hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                  <path
                    d="M6 6l12 12M18 6l-12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-4">
              <DashThemeToggle />
            </div>

            <SidebarNav plan={plan} certUnlocked={allImplemented} className="mt-6" />

            {/* Plan + Upgrade in drawer footer */}
            <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
              <span>
                Plan: <span className="font-semibold capitalize text-foreground">{plan}</span>
              </span>
              {plan === "free" && (
                <a
                  href="/auth/payment"
                  className="ml-3 inline-flex items-center rounded-full border border-border bg-card px-2 py-1 text-xs hover:bg-accent/60"
                >
                  Upgrade
                </a>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Two-column layout */}
      <div className="max-w-screen-2xl mx-auto grid grid-cols-1 md:grid-cols-[270px_minmax(0,1fr)] gap-0 md:gap-6 px-4 md:px-6 py-4">

        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex md:flex-col bg-card border border-border rounded-2xl p-4 h-fit sticky top-[88px] md:w-[270px]">

          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1">
            Navigation
          </div>
          <SidebarNav plan={plan} certUnlocked={allImplemented} className="mt-3" />
          <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
            <span>
              Plan: <span className="font-semibold capitalize text-foreground">{plan}</span>
            </span>
            {plan === "free" && (
              <a
                href="/auth/payment"
                className="ml-3 inline-flex items-center rounded-full border border-border bg-card px-2 py-1 text-xs hover:bg-accent/60"
              >
                Upgrade
              </a>
            )}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {plan === "free"
              ? "Upgrade to unlock detailed recommendations and certificate."
              : allImplemented
              ? "Certificate unlocked for latest audit."
              : "Implement all recommendations to unlock certificate."}
          </div>
        </aside>

        {/* Content */}
        <section className="md:pt-1">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KPI title="Latest Score" value={`${latestScore}%`} trend="↑" tone="emerald" />
            <KPI
              title="Open Recs"
              value={recommendations.filter((r) => r.status !== "implemented").length}
              trend="→"
              tone="amber"
            />
            <KPI
              title="Completed Audits"
              value={audits.filter((a) => a.status === "completed").length}
              trend="→"
              tone="blue"
            />
            <KPI
              title="Critical Findings"
              value={counts.critical ?? 0}
              trend="!"
              tone="rose"
            />
          </div>
              
          {/* Your Audits table (top 5) */}
          <motion.div
            className="mt-6 rounded-2xl border border-border bg-card/90 backdrop-blur shadow-sm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="font-semibold">Recent Audits</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onStartAudit}
                  className={`px-3 h-9 inline-flex items-center rounded-full border border-border bg-card/80 shadow-sm text-sm
                  ${
                    HARD_BLOCK_NEW_AUDIT && !allImplemented
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-accent/60"
                  }`}
                  disabled={HARD_BLOCK_NEW_AUDIT && !allImplemented}
                  title={
                    HARD_BLOCK_NEW_AUDIT && !allImplemented
                      ? "Finish the current audit to start a new one"
                      : ""
                  }
                >
                  Start Audit
                </button>
                {audits.length > 5 && (
                  <button
                    onClick={() => navigate("/audits")}
                    className="px-3 h-9 inline-flex items-center rounded-full border border-border bg-card/80 shadow-sm text-sm hover:bg-accent/60"
                    title="View all audits"
                  >
                    View more →
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-auto rounded-b-2xl">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground">
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Type</th>
                    <th className="py-2 px-3 text-right">Score</th>
                    <th className="py-2 px-3 text-right">Findings</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {top5.length ? (
                    top5.map((a, i) => {
                      const c = a.counts ?? {};
                      const total =
                        (c.critical ?? 0) +
                        (c.high ?? 0) +
                        (c.medium ?? 0) +
                        (c.low ?? 0);

                      const metaOverall = a?.meta?.analytics?.overallPct;
                      const legacyOverall = a?.analytics?.overallPct;

                      const rowScore = (() => {
                        const n = pickNumber(
                          a?.score,
                          a?.meta?.analytics?.score,
                          a?.meta?.analytics?.risk_score,
                          a?.analytics?.score,
                          a?.analytics?.risk_score,
                          metaOverall != null ? 100 - Number(metaOverall) : null,
                          legacyOverall != null ? 100 - Number(legacyOverall) : null
                        );
                        return n !== null
                          ? Math.round(n)
                          : computeScoreFromCounts(a.counts);
                      })();

                      return (
                        <motion.tr
                          key={a.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.03 }}
                          className="border-t border-border hover:bg-accent/40"
                        >
                          <td className="py-2 px-3">
                            {a.created_at
                              ? new Date(a.created_at).toLocaleString()
                              : "—"}
                          </td>
                          <td className="py-2 px-3">{a.user_type}</td>
                          <td className="py-2 px-3 text-right font-semibold">
                            {Math.round(rowScore)}%
                          </td>
                          <td className="py-2 px-3 text-right">{total}</td>
                          <td className="py-2 px-3 text-right">
                            <a
                              href={`/audits/${a.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              View details →
                            </a>
                          </td>
                        </motion.tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="py-3 px-3 text-muted-foreground" colSpan={5}>
                        No audits yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

{/* Your Recommendations (latest audit only) */}
{plan === "free" ? (
  <motion.div
    className="mt-6 rounded-2xl border border-dashed border-border bg-card/90 backdrop-blur shadow-sm text-center p-6"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div className="text-sm font-semibold mb-1">Recommendations Locked</div>
    <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
      Upgrade your plan to view detailed security recommendations for your latest audit
      and unlock your downloadable certificate.
    </p>
    <a
      href="/auth/payment"
      className="inline-flex items-center px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Upgrade to Unlock
    </a>
    <p className="mt-3 text-xs text-muted-foreground">
      You can still run audits and see your overall score on the free plan.
    </p>
  </motion.div>
) : (
  <motion.div
    className="mt-6 rounded-2xl border border-border bg-card/90 backdrop-blur shadow-sm"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="font-semibold">Your Recommendations</div>
      {allImplemented ? (
        <span className="text-xs rounded-full px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          All implemented — certificate unlocked
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {recommendations.filter((r) => r.status !== "implemented").length} open
        </span>
      )}
    </div>
    <div className="overflow-auto rounded-b-2xl">
      <table className="min-w-full text-sm">
        {/* keep your existing thead/tbody mapping here unchanged */}
        ...
      </table>
    </div>
  </motion.div>
)}


        </section>
      </div>
    </div>
  );
}


/* ===================== sidebar / ui helpers ===================== */
function SidebarNav({
  plan,
  certUnlocked,
  className = "",
}: {
  plan: Plan;
  certUnlocked: boolean;
  className?: string;
}) {
  const navigate = useNavigate();

  return (
    <nav className={`space-y-1 text-sm ${className}`}>
      <NavItem icon="🏠" label="Dashboard" onClick={() => navigate("/dashboard")} active />
      <NavItem icon="📄" label="Audits" onClick={() => navigate("/audits")} />
      <NavItem icon="💳" label="Billing" onClick={() => navigate("/billing")} />
      <NavItem
        icon="🤝"
        label="Request Manual Audit"
        onClick={() => navigate("/request-audit")}
      />
      {/* 🔓 Scanner: enabled only for premium */}
     <NavItem
        icon="🧪"
        label={plan === "premium" ? "Smart Contracts Scanner" : "Smart Contracts Scanner (Pro)"}
        onClick={() => {
          if (plan === "premium") {
            navigate("/scanner");
          } else {
            navigate("/auth/payment");
          }
        }}
      />
      <NavItem icon="💬" label="Help us improve" onClick={() => navigate("/feedback")} />


    </nav>
  );
}

function KPI({
  title,
  value,
  trend = "→",
  tone = "blue",
}: {
  title: string;
  value: ReactNode;
  trend?: string;
  tone?: "blue" | "emerald" | "amber" | "rose";
}) {
  const toneMap: Record<string, string> = {
    blue: "from-blue-500 to-indigo-500",
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-yellow-500",
    rose: "from-rose-500 to-pink-500",
  };
  return (
    <motion.div
      className="rounded-2xl border border-border bg-card/90 backdrop-blur p-4 shadow-sm"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-1 flex items-end justify-between">
        <div className="text-2xl font-bold">{value}</div>
        <div
          className={`text-[10px] text-white px-2 py-1 rounded-full bg-gradient-to-r ${toneMap[tone]}`}
        >
          {trend}
        </div>
      </div>
    </motion.div>
  );
}


function NavItem({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const isPro = label.includes("(Pro)");
  const cleanLabel = label.replace(" (Pro)", "");

  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center px-3 py-2 rounded-xl transition
        ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-accent/50 active:scale-[.99]"}
        ${active ? "bg-muted ring-1 ring-border" : ""}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      <span className="text-lg w-5 text-center mr-2">{icon}</span>

      <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
        {/* label can wrap to 2 lines instead of truncating */}
        <span className="font-medium text-sm text-left leading-snug break-words">
          {cleanLabel}
        </span>

        {isPro && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            PRO
          </span>
        )}
      </div>
    </button>
  );
}



function SevPill({ s }: { s: Severity | string }) {
  const map: Record<string, string> = {
    Critical: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    High: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    Low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  };
  return (
    <span className={`px-2 py-1 rounded text-xs ${map[s] ?? "bg-muted text-foreground"}`}>
      {s}
    </span>
  );
}

