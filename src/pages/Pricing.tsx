// src/pages/Pricing.tsx
import { FaCrown, FaUserShield } from "react-icons/fa";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, Variants } from "framer-motion";

/* -------------------------------- Types ---------------------------------- */

type Period = "weekly" | "monthly" | "annual";

/* ----------------------------- Animations -------------------------------- */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const cardV: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

const cardsStagger: Variants = {
  show: { transition: { staggerChildren: 0.08 } },
};

/* -------------------------------- Component ------------------------------ */

export default function Pricing() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("monthly");

  // Display prices only (no logic / no Stripe here)
  const price = useMemo(
    () =>
      ({
        weekly: {
          free: "£0",
          premium: "£7.99",
          premium_sub: "/week",
          premium_note: "",
        },
        monthly: {
          free: "£0",
          premium: "£34.99",
          premium_sub: "/month",
          premium_note: "",
        },
        annual: {
          free: "£0",
          premium: "£329.99",
          premium_sub: "/year",
          premium_note: "Save ~22%",
        },
      } as const),
    []
  );

  type PlanCard = {
    name: string;
    icon: React.ReactElement;
    border: string;
    button: string;
    text: string;
    tag: string | null;
    color: string;
    value: "free" | "premium";
    features: string[];
    price: string;
    priceSub: string;
    note?: string;
  };

  const plans: PlanCard[] = [
    {
      name: "Free Plan",
      icon: <FaUserShield className="mb-4 text-4xl text-indigo-500" />,
      border: "border-slate-200",
      button: "bg-slate-900 hover:bg-slate-950",
      text: "Access self-audit questions only.",
      tag: null,
      color: "text-indigo-500",
      value: "free",
      features: [
        "Self-audit questions",
        "Basic dashboard access",
        "No AI recommendations",
        "No certificate download",
      ],
      price: price[period].free,
      priceSub: "",
    },
    {
      name: "Premium",
      icon: <FaCrown className="mb-4 text-4xl text-purple-600" />,
      border: "border-2 border-purple-600",
      button: "bg-purple-600 hover:bg-purple-700",
      text:
        period === "annual"
          ? "Yearly access to all features & updates."
          : period === "weekly"
          ? "7-day access to all features & updates."
          : "30-day access to all features & updates.",
      tag: "Most Popular",
      color: "text-purple-600",
      value: "premium",
      features: [
        "Unlimited audits",
        "All AI recommendations",
        "Download certificates",
        "Full dashboard access",
        "Priority support",
      ],
      price: price[period].premium,
      priceSub: price[period].premium_sub || "",
      note: price[period].premium_note || "",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      {/* HERO + PRIMARY CTA */}
      <header className="relative overflow-hidden px-4 pt-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-40 max-w-5xl rounded-full bg-gradient-to-b from-indigo-200/40 to-transparent blur-2xl"
        />
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUp}
          className="mx-auto max-w-3xl text-center"
        >
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
            Pricing that scales with your DApp
          </h1>
          <p className="mt-3 text-slate-600">
            Start free. Upgrade anytime for instant AI-powered audit recommendations,
            certificates, and priority support.
          </p>

          <PeriodToggle period={period} setPeriod={setPeriod} />

          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => navigate("/register")}
              className="rounded-full bg-purple-600 px-6 py-3 font-semibold text-white shadow-lg shadow-purple-600/20 transition hover:bg-purple-700"
            >
              Get started →
            </button>
            <button
              onClick={() => navigate("/login")}
              className="rounded-full border border-slate-300 px-6 py-3 font-semibold transition hover:bg-white"
            >
              Sign in
            </button>
          </div>
        </motion.div>
      </header>

      {/* PLANS – purely visual / marketing */}
      <main className="px-4 py-14">
        <motion.div
          variants={cardsStagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2"
        >
          {plans.map((plan, index) => (
            <motion.div
              key={`${plan.name}-${index}`}
              variants={cardV}
              whileHover={{ y: -6, rotateX: 1.5, rotateY: -1.5 }}
              className={`relative flex transform flex-col items-center rounded-2xl border ${plan.border} bg-white p-8 text-center shadow-sm transition hover:shadow-lg`}
            >
              {plan.tag && plan.value === "premium" && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-purple-600 px-3 py-1 text-xs font-medium text-white shadow">
                  {plan.tag}
                </span>
              )}

              {plan.icon}
              <h3 className="mb-1 text-2xl font-semibold">{plan.name}</h3>
              <p className="mb-4 text-slate-500">{plan.text}</p>

              <div className="mb-6">
                <div className="flex items-end justify-center gap-1 overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={`${plan.value}-${plan.price}-${period}`}
                      initial={{ y: 16, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -16, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="text-4xl font-extrabold text-slate-900"
                    >
                      {plan.price}
                    </motion.span>
                  </AnimatePresence>
                  {plan.priceSub && <span className="text-slate-500">{plan.priceSub}</span>}
                </div>
                {plan.note && <div className="mt-1 text-xs text-emerald-600">{plan.note}</div>}
              </div>

              <ul className="mb-6 w-full max-w-xs space-y-2 text-left text-sm text-slate-700">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <CheckCircleIcon className={`mr-2 h-5 w-5 flex-shrink-0 ${plan.color}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate("/register")}
                className={`${plan.button} mt-auto w-full rounded-full px-6 py-2 font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-black/10 focus:ring-offset-2`}
              >
                {plan.value === "premium" ? "Create account" : "Start free"}
              </button>

              {plan.value === "premium" && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-tr from-purple-500/10 via-transparent to-indigo-500/10"
                />
              )}
            </motion.div>
          ))}
        </motion.div>

        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mx-auto mt-16 max-w-6xl rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 py-12 text-center text-white"
        >
          <h3 className="mb-3 text-3xl font-bold">Ready to secure your DApp?</h3>
          <p className="mb-6 text-lg opacity-90">
            Get instant AI-powered audit recommendations and downloadable certificates. Start free,
            upgrade anytime from inside your dashboard.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigate("/register")}
              className="rounded-full bg-white px-8 py-3 font-semibold text-purple-700 shadow transition hover:bg-slate-100"
            >
              Get started →
            </button>
            <button
              onClick={() => navigate("/login")}
              className="rounded-full border border-white/70 px-8 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Sign in
            </button>
          </div>
        </motion.section>

        <div className="mx-auto mt-12 max-w-3xl text-center text-sm text-slate-500">
          AI powered recommendations are generated instantly and can be exported. Premium adds
          priority support. You can manage your subscription from inside your account.
        </div>
      </main>
    </div>
  );
}

/* ----------------------------- Subcomponents ------------------------------ */

function PeriodToggle({
  period,
  setPeriod,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
}) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next: Period =
        period === "weekly" ? "monthly" : period === "monthly" ? "annual" : "weekly";

      setPeriod(next);

    }
  };

  return (
    <div
      role="tablist"
      aria-label="Billing period"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="mx-auto mt-6 inline-flex rounded-full border border-slate-200 bg-white p-1"
    >
      <button
        role="tab"
        aria-selected={period === "weekly"}
        onClick={() => setPeriod("weekly")}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
          period === "weekly" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        Weekly
      </button>
      <button
        role="tab"
        aria-selected={period === "monthly"}
        onClick={() => setPeriod("monthly")}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
          period === "monthly" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        Monthly
      </button>
      <button
        role="tab"
        aria-selected={period === "annual"}
        onClick={() => setPeriod("annual")}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
          period === "annual" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        Yearly {period === "annual" && <span className="ml-1 text-xs opacity-80">— save ~22%</span>}
      </button>
    </div>
  );
}
