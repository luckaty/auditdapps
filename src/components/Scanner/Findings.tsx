import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Findings({
  summaryMd,
  findings,
}: {
  summaryMd: string;
  findings: Array<{
    severity: "Critical" | "High" | "Medium" | "Low";
    title: string;
    description: string;
    remediation?: string;
  }>;
}) {
  const sevColor: Record<string, string> = {
    Critical: "bg-rose-100 text-rose-700",
    High: "bg-orange-100 text-orange-700",
    Medium: "bg-amber-100 text-amber-700",
    Low: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="grid gap-6">
      {summaryMd && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 font-semibold text-slate-800">Summary</div>
          <div className="prose prose-slate max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryMd}</ReactMarkdown>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 font-semibold text-slate-800">Findings</div>

        {findings.length ? (
          <ul className="divide-y divide-slate-200">
            {findings.map((f) => {
              const desc = (f.description ?? "").slice(0, 40);
              const key = `${f.severity}-${f.title}-${desc}`
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");

              return (
                <li key={key} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{f.title}</div>
                      <div className="mt-1 text-sm text-slate-600">{f.description}</div>

                      {f.remediation && (
                        <div className="mt-2 text-sm text-slate-600">
                          <span className="font-medium">Remediation:</span> {f.remediation}
                        </div>
                      )}
                    </div>

                    <span
                      className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium ${sevColor[f.severity]}`}
                    >
                      {f.severity}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-sm text-slate-500">No issues found by the rubric.</div>
        )}
      </div>
    </div>
  );
}
