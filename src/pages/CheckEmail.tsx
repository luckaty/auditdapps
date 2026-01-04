// src/pages/CheckEmail.tsx
import { motion } from "framer-motion";
import { CheckCircle, Mail, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { cardVariants } from "@/lib/motion";



export default function CheckEmail() {
  return (
    <div className="min-h-[100svh] bg-gradient-to-b from-slate-50 via-white to-white relative overflow-hidden">
      {/* Soft background accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
      >
        <div className="absolute -top-28 -right-24 h-72 w-72 rounded-full bg-indigo-200 blur-3xl" />
        <div className="absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-sky-200 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto max-w-2xl px-4 py-16 sm:py-20">
        <motion.section
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border bg-white/80 backdrop-blur-xl shadow-xl ring-1 ring-black/5 p-8 sm:p-10"
          role="status"
          aria-live="polite"
        >
          {/* Header */}
          <div className="flex items-center justify-center">
            <CheckCircle className="h-14 w-14 text-emerald-500" strokeWidth={2.4} aria-hidden />
          </div>
          <h1 className="mt-4 text-center text-3xl font-extrabold tracking-tight text-slate-900">
            Check your email
          </h1>
          <p className="mt-2 text-center text-slate-600">
            We’ve sent a verification link to your inbox. Click the link to activate your account.
          </p>

          {/* Helper notice */}
          <div className="mt-6 rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
            <p className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-slate-500" aria-hidden />
              <span>
                Can’t find it? Check your <span className="font-medium text-slate-800">spam</span> or{" "}
                <span className="font-medium text-slate-800">promotions</span> folder. The link can take up to a minute to arrive.
              </span>
            </p>
          </div>

          {/* Quick provider shortcuts */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <a
              href="https://mail.google.com/"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center justify-between rounded-lg border bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Gmail
              <ExternalLink className="ml-2 h-4 w-4 text-slate-400 group-hover:text-slate-600" aria-hidden />
            </a>
            <a
              href="https://outlook.live.com/mail/"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center justify-between rounded-lg border bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Outlook
              <ExternalLink className="ml-2 h-4 w-4 text-slate-400 group-hover:text-slate-600" aria-hidden />
            </a>
            <a
              href="https://mail.yahoo.com/"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center justify-between rounded-lg border bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Yahoo
              <ExternalLink className="ml-2 h-4 w-4 text-slate-400 group-hover:text-slate-600" aria-hidden />
            </a>
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/login"
              className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Back to login
            </Link>
            <Link
              to="/resend"
              className="inline-flex h-10 items-center rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Resend verification
            </Link>
          </div>

          {/* tiny footnote */}
          <p className="mt-4 text-center text-xs text-slate-500">
            If the link doesn’t work, copy/paste it into your browser and ensure it’s opened in the same device.
          </p>
        </motion.section>
      </main>
    </div>
  );
}
