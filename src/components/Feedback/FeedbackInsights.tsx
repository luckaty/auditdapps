import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type Row = {
  day: string; // YYYY-MM-DD
  feedback_count: number;
  avg_overall_rating: number;
  recommend_rate: number; // 0..1
};

export default function FeedbackInsights() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErr(null);

      const { data, error } = await supabase
        .from("feedback_daily")
        .select("day, feedback_count, avg_overall_rating, recommend_rate")
        .order("day", { ascending: true })
        .limit(90);

      if (cancelled) return;

      if (error) {
        setErr(error.message);
        return;
      }

      setRows((data ?? []) as Row[]);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const labels = useMemo(() => rows.map((r) => r.day), [rows]);

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        { label: "Avg rating (1–5)", data: rows.map((r) => r.avg_overall_rating), tension: 0.25 },
        { label: "Recommend rate (%)", data: rows.map((r) => Math.round((r.recommend_rate ?? 0) * 100)), tension: 0.25 },
        { label: "Feedback count", data: rows.map((r) => r.feedback_count), tension: 0.25 },
      ],
    }),
    [labels, rows]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      plugins: { legend: { position: "bottom" as const } },
      scales: { y: { beginAtZero: true } },
    }),
    []
  );

  return (
    <div className="rounded-2xl border border-border bg-card/90 backdrop-blur p-5 shadow-sm">
      <h3 className="text-sm font-semibold">User feedback trends</h3>
      <p className="text-xs text-muted-foreground mt-1">
        Screenshot this for evidence: ratings, recommendation rate, and volume over time.
      </p>

      {err && (
        <div className="mt-3 rounded-lg border border-rose-500/60 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </div>
      )}

      <div className="mt-4">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
