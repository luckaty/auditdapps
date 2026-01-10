// src/components/Feedback/FeedbackWidget.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Loader2,
  MessageSquare,
  Star,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

type Props = {
  auditId?: string | null;
  surface?: "dashboard" | "scanner" | "results" | "feedback";
  slitherEnabled?: boolean;
  aiEnabled?: boolean;
  appVersion?: string;
  onSubmitted?: () => void;
  onBackToDashboard?: () => void;
};

function StarRating({
  value,
  onChange,
  label,
  hint,
}: {
  value: number | null;
  onChange: (n: number) => void;
  label: string;
  hint?: string;
}) {
  const v = value ?? 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium">{label}</div>
        {hint ? (
          <div className="text-[11px] text-muted-foreground">{hint}</div>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => {
          const n = i + 1;
          const active = n <= v;

          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={[
                "h-9 w-9 rounded-xl border transition grid place-items-center",
                "bg-background border-border hover:bg-accent/60",
                active ? "text-amber-500" : "text-muted-foreground",
              ].join(" ")}
              aria-label={`Set ${label} rating to ${n}`}
              title={`${n}`}
            >
              <Star className={["h-4 w-4", active ? "fill-current" : ""].join(" ")} />
            </button>
          );
        })}

        <div className="ml-2 text-xs text-muted-foreground">
          {value ? `${value}/5` : "Not set"}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      {desc ? <p className="text-xs text-muted-foreground mt-1">{desc}</p> : null}
    </div>
  );
}

export default function FeedbackWidget({
  auditId = null,
  surface = "feedback",
  slitherEnabled = false,
  aiEnabled = true,
  appVersion,
  onSubmitted,
  onBackToDashboard,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [submitted, setSubmitted] = useState(false);

  // Step 1 (required)
  const [overall, setOverall] = useState<number | null>(null);
  const [clarity, setClarity] = useState<number | null>(null);
  const [recommend, setRecommend] = useState<boolean | null>(null);

  // Step 2 (optional)
  const [fixedIssue, setFixedIssue] = useState<boolean | null>(null);
  const [whatFixed, setWhatFixed] = useState("");
  const [outcome, setOutcome] = useState("");
  const [helpful, setHelpful] = useState("");
  const [confusing, setConfusing] = useState("");
  const [improve, setImprove] = useState("");

  const [testimonial, setTestimonial] = useState("");
  const [consentPublic, setConsentPublic] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canGoNext = useMemo(() => {
    return overall !== null && clarity !== null && recommend !== null;
  }, [overall, clarity, recommend]);

  const canSubmit = useMemo(() => {
    return canGoNext && !loading;
  }, [canGoNext, loading]);

  // ✅ Auto-scroll the card into view when success state shows
  useEffect(() => {
    if (!submitted) return;
    requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [submitted]);

  // ✅ If user moves between steps, keep the card top aligned (subtle polish)
  useEffect(() => {
    if (submitted) return;
    requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [step, submitted]);

  const resetAll = () => {
    setSubmitted(false);
    setStep(1);

    setOverall(null);
    setClarity(null);
    setRecommend(null);

    setFixedIssue(null);
    setWhatFixed("");
    setOutcome("");

    setHelpful("");
    setConfusing("");
    setImprove("");

    setTestimonial("");
    setConsentPublic(false);

    setErr(null);

    requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const submit = async () => {
    setErr(null);

    // guard required fields
    if (!canGoNext || overall == null || clarity == null || recommend == null) {
      setErr("Please complete the ratings and recommendation first.");
      setStep(1);
      requestAnimationFrame(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("You must be logged in to submit feedback.");

      const payload = {
        user_id: userId,
        audit_id: auditId,
        surface,
        slither_enabled: !!slitherEnabled,
        ai_enabled: !!aiEnabled,
        app_version: appVersion ?? null,

        overall_rating: overall,
        clarity_rating: clarity,
        would_recommend: recommend,

        fixed_issue: fixedIssue,
        what_fixed: whatFixed.trim() || null,
        outcome: outcome.trim() || null,

        what_was_helpful: helpful.trim() || null,
        what_was_confusing: confusing.trim() || null,
        what_should_improve: improve.trim() || null,

        testimonial: testimonial.trim() || null,
        consent_public: !!consentPublic,
      };

      const { error } = await supabase.from("product_feedback").insert(payload);
      if (error) throw error;

      setSubmitted(true);
      onSubmitted?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg || "Failed to submit feedback.");
      requestAnimationFrame(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className="rounded-2xl border border-border bg-card/90 backdrop-blur p-5 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-2xl bg-blue-600 text-white grid place-items-center">
            <MessageSquare className="h-4 w-4" />
          </div>

          <div>
            <h3 className="text-sm font-semibold">Feedback</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Your feedback helps us improve the quality of findings and recommendations.
            </p>
          </div>
        </div>

        {!submitted ? (
          <div className="text-[11px] text-muted-foreground">
            Step <span className="font-medium text-foreground">{step}</span> / 2
          </div>
        ) : null}
      </div>

      {/* Error */}
      {err ? (
        <div className="mt-4 rounded-lg border border-rose-500/60 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </div>
      ) : null}

      {/* ✅ Success state */}
      {submitted ? (
        <div className="mt-5">
          <div className="rounded-2xl border border-border bg-background p-5 sm:p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white grid place-items-center shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold">Thank you! 🎉</div>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  We really appreciate it. Your feedback helps us improve scan clarity,
                  recommendation quality, and the overall experience.
                </p>

                <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
                  {onBackToDashboard ? (
                    <button
                      type="button"
                      onClick={onBackToDashboard}
                      className="h-10 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 inline-flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to dashboard
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={resetAll}
                    className="h-10 px-4 rounded-xl border border-border bg-background hover:bg-accent/60 text-sm font-semibold inline-flex items-center justify-center"
                  >
                    Send another feedback
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 text-[11px] text-muted-foreground">
              Please don’t include secrets, private keys, or seed phrases. For bigger issues,
              use the Contact page.
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-5">
          {step === 1 ? (
            <>
              <SectionTitle
                title="Quick ratings"
                desc="This takes less than 30 seconds. Optional details come next."
              />

              <div className="grid gap-4 md:grid-cols-2">
                <StarRating
                  label="Overall value"
                  hint="How useful was this?"
                  value={overall}
                  onChange={setOverall}
                />
                <StarRating
                  label="Clarity of findings"
                  hint="How clear were the results?"
                  value={clarity}
                  onChange={setClarity}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-xs font-medium">
                  Would you recommend AuditDApps to another dev/team?
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRecommend(true)}
                    className={[
                      "h-9 px-3 rounded-xl border text-xs font-semibold transition",
                      recommend === true
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-background border-border hover:bg-accent/60",
                    ].join(" ")}
                  >
                    Yes
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecommend(false)}
                    className={[
                      "h-9 px-3 rounded-xl border text-xs font-semibold transition",
                      recommend === false
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-background border-border hover:bg-accent/60",
                    ].join(" ")}
                  >
                    No
                  </button>

                  {recommend === null ? (
                    <span className="text-xs text-muted-foreground ml-2">Choose one</span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setErr(null);
                    if (canGoNext) setStep(2);
                    else setErr("Please complete the ratings and recommendation first.");
                  }}
                  disabled={!canGoNext}
                  className="h-10 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <>
              <SectionTitle
                title="Optional details"
                desc="If you have time, these answers help a lot. You can also submit without filling them."
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium">
                    Did you fix anything because of this scan?
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFixedIssue(true)}
                      className={[
                        "h-9 px-3 rounded-xl border text-xs font-semibold",
                        fixedIssue === true
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-background border-border hover:bg-accent/60",
                      ].join(" ")}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setFixedIssue(false)}
                      className={[
                        "h-9 px-3 rounded-xl border text-xs font-semibold",
                        fixedIssue === false
                          ? "bg-slate-800 text-white border-slate-800"
                          : "bg-background border-border hover:bg-accent/60",
                      ].join(" ")}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => setFixedIssue(null)}
                      className="h-9 px-3 rounded-xl border text-xs font-semibold bg-background border-border hover:bg-accent/60"
                      title="Clear"
                    >
                      Clear
                    </button>
                  </div>

                  {fixedIssue === true ? (
                    <textarea
                      value={whatFixed}
                      onChange={(e) => setWhatFixed(e.target.value)}
                      rows={3}
                      placeholder="What did you fix? (Example: reentrancy in withdraw, missing access control...)"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium">
                    What did you do next after seeing the results?
                  </div>
                  <textarea
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    rows={4}
                    placeholder="Example: delayed deployment, added tests, refactored withdrawal flow, scheduled a manual audit..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-xs font-medium">Most helpful part</div>
                  <textarea
                    value={helpful}
                    onChange={(e) => setHelpful(e.target.value)}
                    rows={3}
                    placeholder="What helped you most?"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium">Most confusing part</div>
                  <textarea
                    value={confusing}
                    onChange={(e) => setConfusing(e.target.value)}
                    rows={3}
                    placeholder="What was unclear?"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium">One improvement you want next</div>
                  <textarea
                    value={improve}
                    onChange={(e) => setImprove(e.target.value)}
                    rows={3}
                    placeholder="What should we build next?"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-xs font-semibold mb-2">Optional: short testimonial</div>
                <textarea
                  value={testimonial}
                  onChange={(e) => setTestimonial(e.target.value)}
                  rows={3}
                  placeholder="One sentence you’d be happy for us to quote (only if you consent below)."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={consentPublic}
                    onChange={(e) => setConsentPublic(e.target.checked)}
                  />
                  I consent to this testimonial being used publicly (no private data).
                </label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setErr(null);
                    setStep(1);
                  }}
                  className="h-10 px-4 rounded-xl border border-border bg-background hover:bg-accent/60 text-sm font-semibold"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit}
                  className="h-10 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-md hover:bg-blue-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Submit feedback
                </button>
              </div>

              <div className="text-[11px] text-muted-foreground text-center">
                Please avoid secrets, keys, or wallet seed phrases.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
