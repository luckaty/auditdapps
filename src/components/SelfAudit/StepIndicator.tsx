// src/components/SelfAudit/StepIndicator.tsx
import React, { FC } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number; // 0-based
}

const steps = ["Agreement", "Select Type", "Checklist", "Submit"];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

const StepIndicator: FC<StepIndicatorProps> = ({ currentStep }) => {
  const active = clamp(currentStep, 0, steps.length - 1);
  const pct = (active / (steps.length - 1)) * 100;

  return (
    <div className="relative mx-auto w-full max-w-4xl">
      {/* Progressbar (a11y) */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={`Self-audit progress: step ${active + 1} of ${steps.length}`}
        className="sr-only"
      />

      {/* Track */}
      <div className="relative h-1.5 rounded-full bg-slate-200">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-sky-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Steps */}
      <div className="mt-3 grid grid-cols-4">
        {steps.map((label, idx) => {
          const isCompleted = idx < active;
          const isActive = idx === active;

          return (
            <div key={label} className="flex flex-col items-center text-center">
              <motion.div
                className={[
                  "grid h-9 w-9 place-items-center rounded-full text-sm font-semibold shadow-sm",
                  isCompleted
                    ? "bg-emerald-500 text-white ring-1 ring-emerald-400"
                    : isActive
                    ? "bg-indigo-600 text-white ring-2 ring-indigo-300"
                    : "bg-white text-slate-600 ring-1 ring-slate-300",
                ].join(" ")}
                initial={{ scale: 0.9, opacity: 0.85 }}
                animate={{ scale: isActive ? 1.05 : 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${idx + 1} of ${steps.length}: ${label}${
                  isCompleted ? " (completed)" : isActive ? " (current)" : ""
                }`}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : idx + 1}
              </motion.div>

              <div
                className={[
                  "mt-1 text-[12px] leading-4",
                  isActive || isCompleted ? "text-slate-900 font-medium" : "text-slate-400",
                ].join(" ")}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
