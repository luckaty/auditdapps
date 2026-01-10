// src/pages/Feedback.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashThemeToggle from "@/components/DashThemeToggle";
import FeedbackWidget from "@/components/Feedback/FeedbackWidget";
import { supabase } from "@/lib/supabaseClient";

export default function FeedbackPage() {
  const navigate = useNavigate();
  const [auditId, setAuditId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;
      if (!userId) return;

      const { data: audits, error } = await supabase
        .from("audits")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!mounted) return;

      if (!error && audits?.[0]?.id) {
        setAuditId(audits[0].id);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <header className="mb-6 md:mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Help us improve
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              Tell us what worked, what didn’t, and what you want next. This takes ~2 minutes.
            </p>
          </div>

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

            <p className="text-xs text-muted-foreground max-w-sm">
              Your feedback helps us improve the quality of findings and recommendations.
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card/90 backdrop-blur p-5 md:p-6 shadow-sm">
          <FeedbackWidget
            surface="feedback"
            auditId={auditId}
            slitherEnabled={false}
            aiEnabled={true}
            appVersion={import.meta.env.VITE_APP_VERSION}
            onBackToDashboard={() => navigate("/dashboard")}
          />
        </section>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Want to share a bigger issue?{" "}
          <a href="/contact" className="underline hover:text-blue-600">
            Contact us
          </a>
          .
        </p>
      </div>
    </div>
  );
}
