// src/pages/Register.tsx
import { useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Shield,
  Building2,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  LoaderCircle,
  Chrome,
  Github,
  UserRoundCog,
} from "lucide-react";

type Role = "Developer" | "Organization" | "Project Lead" | "Other";
type OAuthProvider = "google" | "github";

function rule(label: string, ok: boolean) {
  return (
    <li className={`flex items-center gap-2 text-xs ${ok ? "text-emerald-700" : "text-slate-500"}`}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />
      {label}
    </li>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const nextParam = new URLSearchParams(location.search).get("next") || "";


  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [role, setRole] = useState<Role>("Developer");

  const [showPw, setShowPw] = useState(false);
  const [caps, setCaps] = useState(false);
  const [agree, setAgree] = useState(true);

  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<null | { ok: boolean; msg: string }>(null);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") {
      setCaps(e.getModifierState("CapsLock"));
    }
  };

  // password checks
  const emailOk = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);
  const hasLen = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const pwOk = hasLen && hasLetter && hasNumber;

  const strength =
  (hasLen ? 1 : 0) +
  (hasLetter ? 1 : 0) +
  (hasNumber ? 1 : 0) +
  (hasSymbol ? 1 : 0);
  const strengthLabel = ["Very weak", "Weak", "Okay", "Good", "Strong"][strength];

  const valid = emailOk && pwOk && orgName.trim().length >= 2 && agree && !loading;

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!valid) return;

    setLoading(true);
    setBanner(null);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: nextParam
          ? `${window.location.origin}/email-confirmed?next=${encodeURIComponent(nextParam)}`
          : `${window.location.origin}/email-confirmed`,

          data: { org_name: orgName, role },
        },
      });

      if (error) {
        setBanner({ ok: false, msg: error.message || "Sign up failed." });
        toast.error(error.message || "Sign up failed.");
        setLoading(false);
        return;
      }

      localStorage.setItem("pending_signup_email", email);
      setBanner({ ok: true, msg: "Confirmation email sent. Check your inbox." });
      toast.success("Confirmation email sent.");
      setTimeout(
        () => navigate(nextParam ? `/check-email?next=${encodeURIComponent(nextParam)}` : "/check-email"),
        600
      );
    } catch (err: any) {
      console.error("Unexpected register error =>", err);
      setBanner({ ok: false, msg: "Something went wrong. Please try again." });
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const loginWithProvider = async (provider: OAuthProvider) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/login?type=signup` },
      });
      if (error) {
        setLoading(false);
        setBanner({ ok: false, msg: "OAuth sign-in failed." });
        toast.error("OAuth sign-in failed.");
      }
    } catch {
      setLoading(false);
      setBanner({ ok: false, msg: "OAuth sign-in failed." });
      toast.error("OAuth sign-in failed.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border bg-white/90 backdrop-blur-xl shadow-2xl p-8 relative">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl grid place-items-center bg-indigo-600 text-white shadow-sm">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">Create Secure Account</h1>
              <p className="text-sm text-slate-500">Start your audit journey with best-practice auth.</p>
            </div>
          </div>

          {/* Banners */}
          {banner && banner.ok && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700 ring-1 ring-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
              <span>{banner.msg}</span>
            </div>
          )}
          {banner && !banner.ok && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-rose-700 ring-1 ring-rose-100" role="alert">
              <XCircle className="h-4 w-4" />
              <span>{banner.msg}</span>
            </div>
          )}

          {/* Form */}
          <form id="register-form" onSubmit={handleRegister} className="grid gap-5 md:grid-cols-2 md:gap-6">
            {/* Email */}
            <div className="md:col-span-2">
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Work email</label>
              <div className="relative">
                <input
                  id="email" 
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pl-10 text-[15px] outline-none ring-blue-500/30 focus:ring-2"
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
              {!emailOk && email.length > 0 && <p className="mt-1 text-xs text-amber-600">Enter a valid email.</p>}
            </div>

            {/* Org */}
            <div>
              <label htmlFor="orgname" className="mb-1 block text-sm font-medium text-slate-700">Organization / Project</label>
              <div className="relative">
                <input
                  id="orgname"
                  name="orgname"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pl-10 text-[15px] outline-none ring-blue-500/30 focus:ring-2"
                  placeholder="Audit Dapps Inc."
                  autoComplete="organization"
                  required
                />
                <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="mb-1 block text-sm font-medium text-slate-700">Your role</label>
              <div className="relative">
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pl-10 text-[15px] outline-none ring-blue-500/30 focus:ring-2"
                >
                  <option>Developer</option>
                  <option>Organization</option>
                  <option>Project Lead</option>
                  <option>Other</option>
                </select>
                <UserRoundCog className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Password */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
                <span className="text-xs text-slate-500">{strengthLabel}</span>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={onKey}
                  onKeyDown={onKey}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pl-10 pr-10 text-[15px] outline-none ring-blue-500/30 focus:ring-2"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                />
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {/* Strength bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-slate-200">
                <div
                  className={`h-full transition-all ${
                    ["w-0 bg-slate-300", "w-1/4 bg-rose-500", "w-2/4 bg-amber-500", "w-3/4 bg-emerald-500", "w-full bg-emerald-600"][strength]
                  }`}
                />
              </div>

              {caps && <p className="mt-1 text-xs text-amber-600">Caps Lock is on</p>}

              {/* Rules checklist */}
              <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                {rule("8+ characters", hasLen)}
                {rule("Letter (a–z)", hasLetter)}
                {rule("Number (0–9)", hasNumber)}
                {rule("Symbol (!@#$…)", hasSymbol)}
              </ul>
            </div>

            {/* Terms */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                I agree to the{" "}
                <a href="/terms" className="text-blue-600 hover:underline">
                  Terms
                </a>{" "}
                &{" "}
                <a href="/privacy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </a>
              </label>
            </div>

            {/* Primary CTA – full width below fields */}
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={!valid}
                className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-600/20
                           hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition inline-flex items-center justify-center gap-2"
              >
                {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
                {loading ? "Creating…" : "Create Account"}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center my-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="mx-3 text-xs text-slate-500">OR</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* OAuth buttons */}
          <div className="grid gap-3 md:grid-cols-2">
            <button
              onClick={() => loginWithProvider("google")}
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 py-2.5 hover:bg-slate-50 inline-flex items-center justify-center gap-2"
            >
              <Chrome className="h-4 w-4" />
              Sign up with Google
            </button>
            <button
              onClick={() => loginWithProvider("github")}
              disabled={loading}
              className="w-full rounded-lg bg-slate-900 text-white py-2.5 hover:bg-black inline-flex items-center justify-center gap-2"
            >
              <Github className="h-4 w-4" />
              Sign up with GitHub
            </button>
          </div>

          {/* Footer */}
          <p className="mt-5 text-center text-xs text-slate-500">
            Already have an account?{" "}
            <a href="/login" className="text-blue-600 hover:underline">
              Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
