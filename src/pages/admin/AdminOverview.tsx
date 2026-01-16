import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabaseClient";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

type MetricsResponse = {
  ok: true;
  rangeDays: number;
  cards: {
    users: number;
    newUsers7: number;
    newUsers30: number;

    audits: number;
    audits24h: number;
    audits7: number;
    avgScore30: number | null;

    premiumActive: number;
    openHighCritical: number;

    manualReq7: number;
    feedback7: number;
  };
  charts: {
    auditsPerDay: { day: string; audits: number }[];
    severityDist: { severity: string; count: number }[];
    premiumTrend: { day: string; premium: number; free: number }[];
    feedbackTrend: { day: string; avg_rating: number; count: number }[];
  };
};

function StatCard(props: {
  title: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {props.title}
      </div>
      <div className="mt-2 text-2xl font-bold">{props.value}</div>
      {props.hint ? (
        <div className="mt-1 text-xs text-muted-foreground">{props.hint}</div>
      ) : null}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-7 w-20 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-3 w-40 animate-pulse rounded bg-muted" />
    </div>
  );
}

async function fetchAdminMetrics(days: number) {
  const { data, error } = await supabase.functions.invoke("admin-metrics", {
    body: { days },
  });

  if (error) {
    const msg =
      (error as any)?.context?.statusText ||
      (data as any)?.error ||
      error.message ||
      "Request failed";
    throw new Error(msg);
  }

  if ((data as any)?.error) throw new Error((data as any).error);

  return data as MetricsResponse;
}

export default function AdminOverview() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminMetrics(days);
      setMetrics(res);
    } catch (e) {
      console.error("[AdminOverview] load error", e);
      toast.error(e instanceof Error ? e.message : "Could not load admin metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const auditsChart = useMemo(() => metrics?.charts.auditsPerDay ?? [], [metrics]);
  const severityChart = useMemo(() => metrics?.charts.severityDist ?? [], [metrics]);
  const premiumChart = useMemo(() => metrics?.charts.premiumTrend ?? [], [metrics]);
  const feedbackChart = useMemo(() => metrics?.charts.feedbackTrend ?? [], [metrics]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Overview</h1>
          <p className="text-sm text-muted-foreground">
            Platform health, growth, usage, risk signals and feedback.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
          </select>

          <button
            onClick={load}
            className="h-10 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-accent/60"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !metrics ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard title="Total users" value={metrics.cards.users} hint={`+${metrics.cards.newUsers7} last 7d`} />
            <StatCard title="New users (30d)" value={metrics.cards.newUsers30} hint="Profiles created" />
            <StatCard title="Total audits" value={metrics.cards.audits} hint={`${metrics.cards.audits24h} last 24h`} />
            <StatCard title="Audits (7d)" value={metrics.cards.audits7} hint={`Avg score 30d: ${metrics.cards.avgScore30 ?? "—"}`} />
            <StatCard title="Premium active" value={metrics.cards.premiumActive} hint="Expiry-aware" />
            <StatCard title="Open High/Critical" value={metrics.cards.openHighCritical} hint="Recommendations" />
            <StatCard title="Manual requests (7d)" value={metrics.cards.manualReq7} hint="Intake pipeline" />
            <StatCard title="Feedback (7d)" value={metrics.cards.feedback7} hint="User sentiment" />
          </>
        )}
      </section>

      {/* Charts */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Audits per day</div>
              <div className="text-xs text-muted-foreground">Last {days} days</div>
            </div>
          </div>

          <div className="h-64">
            {auditsChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={auditsChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="audits" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                No audit data yet for this range.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2">
            <div className="text-sm font-semibold">Severity distribution</div>
            <div className="text-xs text-muted-foreground">Across audits in range</div>
          </div>

          <div className="h-64">
            {severityChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="severity" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                No recommendations yet for this range.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2">
            <div className="text-sm font-semibold">Premium vs Free signups</div>
            <div className="text-xs text-muted-foreground">Conversion proxy over time</div>
          </div>

          <div className="h-64">
            {premiumChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={premiumChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="premium" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="free" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                No signup trend data yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2">
            <div className="text-sm font-semibold">Feedback rating trend</div>
            <div className="text-xs text-muted-foreground">Avg rating per day</div>
          </div>

          <div className="h-64">
            {feedbackChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={feedbackChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 5]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg_rating" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                No feedback yet for this range.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
