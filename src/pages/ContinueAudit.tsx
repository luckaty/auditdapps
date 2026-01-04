// src/pages/ContinueAudit.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import {
  loadPendingAnswers,
  clearPendingAnswers,
  savePendingAudit,
  clearPendingAudit,
} from "@/lib/pendingAudit";
import { useResultsStore, PreviewResults as PreviewResultsType } from "@/store/resultsStore";

import { formatAuditResponses } from "@/utils/formatPrompt";
import { getRecommendations } from "@/utils/openai";
import { summarizeBaseline } from "@/scoring/baseline";

type TitleCaseUser = "Developer" | "Organization";

function normSeverity(s?: string) {
  const v = (s || "").toLowerCase();
  if (v === "critical") return "Critical";
  if (v === "high") return "High";
  if (v === "medium") return "Medium";
  if (v === "low") return "Low";
  return "Medium";
}

function normMitigation(m?: string) {
  const v = (m || "").toLowerCase();
  if (v === "full") return "full";
  if (v === "partial") return "partial";
  return "none";
}

export default function ContinueAudit() {
  const navigate = useNavigate();
  const setResults = useResultsStore((s) => s.setResults);
  const [error, setError] = useState<string | null>(null);

  // prevent double execution in StrictMode
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    (async () => {
      // 1) Must be signed in
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        console.error("[ContinueAudit] auth error:", authErr);
      }
      const user = authData?.user;
      if (!user) {
        navigate(`/login?next=${encodeURIComponent("/continue-audit")}`);
        return;
      }

      // 2) Load profile to know if they are premium
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("is_premium, premium_expires_at")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        console.error("[ContinueAudit] profile error:", profileErr);
      }

      const isPremium = !!profile?.is_premium;
      const isExpired =
        profile?.premium_expires_at
          ? new Date(profile.premium_expires_at).getTime() <= Date.now()
          : false;

      // premium = true AND not expired
      const hasPremiumAccess = isPremium && !isExpired;


      // 3) Pull answers stored by SelfAudit
      const pending = loadPendingAnswers();
      if (!pending) {
        // nothing to process – maybe user refreshed or already used
        navigate("/self-audit");
        return;
      }

      // clear immediately so a second visit / refresh can't re-use these answers
      clearPendingAnswers();

      try {
        const { responses, othersInput, questionsInOrder } = pending.answers as {
          responses: Record<string, string[]>;
          othersInput: Record<string, string>;
          questionsInOrder: Array<{ question: string }>;
        };

        const userTypeTitle: TitleCaseUser = pending.user_type as TitleCaseUser;
        const userTypeLower = userTypeTitle.toLowerCase() as "developer" | "organization";

        // 4) Build OpenAI prompt
        const prompt = formatAuditResponses(
          responses,
          othersInput,
          userTypeTitle,
          questionsInOrder
        );

        // 5) Baseline (deterministic counts + findings + scores)
        const base = summarizeBaseline(responses, userTypeLower);

        const safeOverall = Number.isFinite(Number(base?.overallPct))
          ? Number(base!.overallPct)
          : null;

        const safeScore =
          Number.isFinite(Number(base?.score))
            ? Math.max(0, Math.min(100, Math.round(Number(base!.score))))
            : safeOverall !== null
            ? Math.max(0, Math.min(100, 100 - Math.round(safeOverall)))
            : 0;

        const normalizedFindings = (base.findings ?? []).map((f: any) => ({
          text: f.text || "",
          severity: normSeverity(f.severity),
          likelihood: f.likelihood || null,
          mitigation: normMitigation(f.mitigation),
        }));

        const totals = base.totals ?? null;
        const counts =
          totals && (totals as any).bySev ? (totals as any).bySev : totals ?? {};

        // 6) LLM narrative (markdown recommendations)
        const md = await getRecommendations(prompt);

        const analyticsPayload = {
          summary_md: md,
          source: "baseline+llm_narrative@v2",
          score: safeScore,
          risk_score: safeScore,
          overallPct: safeOverall,
        };

        // 7) Hydrate in-memory results
        const hydrated: PreviewResultsType = {
          score: safeScore,
          summary_md: md || "",
          findings: (normalizedFindings ?? []).slice(0, 6).map((f: any) => ({
            severity: f.severity ?? "Medium",
            title: String(f.text ?? "Security improvement"),
            description: "",
          })),
          baseline_findings: normalizedFindings,
          counts,
          analytics: analyticsPayload,
          meta: {
            analytics: analyticsPayload,
          },
          user_type: userTypeTitle,
        };

        setResults(hydrated);

        // Lightweight local copy
        savePendingAudit({
          score: hydrated.score,
          summary_md: hydrated.summary_md,
          baseline_findings: hydrated.baseline_findings ?? [],
          counts: hydrated.counts ?? null,
          analytics: hydrated.analytics,
          meta: hydrated.meta,
          user_type: hydrated.user_type as TitleCaseUser,
        });

        // 8) Insert into "audits"
        const auditInsertPayload = {
          user_id: user.id,
          user_type: userTypeTitle,
          status: "completed" as const,
          score: safeScore,
          overall_pct: safeOverall !== null ? Math.round(safeOverall) : null,
          counts,
          totals,
          baseline_findings: normalizedFindings,
          recommendations_md: md,
          analytics: analyticsPayload,
          meta: {
            source: "self_audit_v2",
            user_type: userTypeTitle,
            question_order: questionsInOrder.map((q) => q.question),
          },
          answers: {
            responses,
            othersInput,
            questionsInOrder,
          },
        };

        const { data: newAudit, error: auditErr } = await supabase
          .from("audits")
          .insert(auditInsertPayload as any)
          .select("id")
          .single();

        if (auditErr) {
          console.error("[ContinueAudit] Supabase insert error:", auditErr);
          throw auditErr;
        }

        const auditId: string | undefined = (newAudit as any)?.id;

        // 9) Insert recommendations into public.recommendations
        if (auditId && normalizedFindings.length > 0) {
          const recRows = normalizedFindings.map((f, idx) => ({
            audit_id: auditId,
            title: f.text?.slice(0, 180) || `Recommendation ${idx + 1}`,
            severity: f.severity || "Medium",
            status: "open",
            rationale: f.text || "",
            likelihood: f.likelihood,
            mitigation: f.mitigation,
            weight: 1,
            meta: {
              source: "baseline_v2",
              index: idx,
            },
          }));

          const { error: recErr } = await supabase
            .from("recommendations")
            .insert(recRows as any);

          if (recErr) {
            console.error("[ContinueAudit] recommendations insert error:", recErr);
          }
        }

        // 10) Clean up local pending audit meta
        clearPendingAudit();

        // 11) Redirect:
        //     - Premium users → go straight to audit details
        //     - Free users   → go to dashboard (where audit is visible but gated)
        if (hasPremiumAccess && auditId) {
          navigate(`/audits/${auditId}`);
        } else {
          navigate("/dashboard");
        }

      } catch (e: any) {
        console.error("[ContinueAudit] generation error:", e);
        setError(e?.message || "Failed to generate and save results.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="max-w-md rounded-xl border p-4 text-sm">
          <div className="mb-2 font-semibold">We hit a snag</div>
          <div className="text-muted-foreground">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        Generating your audit results and saving them to your account…
      </div>
    </div>
  );
}
