import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import AuditCycle from "./components/AuditCycle";
import WhatWeDo from "./components/WhatWeDo";
import BestService from "./components/BestService";
import Footer from "./components/Footer";
import ForgotPassword from "./pages/ForgotPassword";
import UpdatePassword from "./pages/UpdatePassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import ScannerPage from "@/pages/Scanner";
import RequestManualAudit from "@/pages/RequestManualAudit";
import Audits from "@/pages/Audits";
import ContinueAudit from "@/pages/ContinueAudit";
import About from "./pages/About";
import Contact from "./pages/Contact";
import SelfAudit from "./pages/SelfAudit";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CheckEmail from "./pages/CheckEmail";
import Resend from "./pages/Resend";
import AuthCallback from "./pages/AuthCallback";
import Payment from "./pages/Payment";
import HowItWorks from "./pages/HowItWorks";
import Pricing from "./pages/Pricing";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import AuditDetails from "./pages/AuditDetails";
import NotFound from "./pages/NotFound";
import Home from "./pages/Home";

import AdminRoute from "./components/AdminRoute";
import AdminLayout from "./components/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import PostEditor from "./pages/PostEditor";
import BillingPage from "./pages/Billing";
import {PaymentSuccess} from "./pages/PaymentSuccess";
import EmailConfirmed from "./pages/EmailConfirmed";

import ComplianceBadges from "./components/ComplianceBadges";
import { ThemeProvider } from "./components/theme/ThemeProvider";

import { supabase } from "@/lib/supabaseClient";
import { loadAndPersistPendingAudit } from "@/lib/pendingAudit";

// ⛔ OLD ProtectedRoute removed from dashboard
import { RequireAuth } from "./components/RequireAuth";
import { RequirePremium } from "./components/RequirePremium";

/* ------------------ AUTH EFFECT – CLEANED UP ------------------ */
/* this no longer forces pricing on sign in */
function AuthEffect() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN") {
        await loadAndPersistPendingAudit(); // keep behavior but no redirect
      }
    });
    return () => sub.subscription?.unsubscribe();
  }, [navigate]);

  return null;
}
/* --------------------------------------------------------------- */

function HomeLanding() {
  return (
    <>
      <Hero />
      <div className="mt-10 sm:mt-14">
        <ComplianceBadges />
      </div>
      <WhatWeDo />
      <BestService />
      <AuditCycle />
    </>
  );
}

function AppShell() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <>
      {!isAdmin && <Navbar />}

      <AuthEffect />

      <Routes>
        <Route path="/" element={<Home />} />

        {/* Static pages */}
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />

        {/* Audit flow */}
        <Route path="/self-audit" element={<SelfAudit />} />
        <Route path="/continue-audit" element={<ContinueAudit />} />

        {/* Auth */}
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/resend" element={<Resend />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Pricing / payment */}
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/auth/payment" element={<Payment />} />

        {/* Blog / other pages */}
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:id" element={<BlogPost />} />
         <Route path="/email-confirmed" element={<EmailConfirmed />} />

        {/* Audits */}
        <Route path="/audits" element={<Audits />} />
        <Route path="/audits/:id" element={ <RequirePremium>
      <AuditDetails />
    </RequirePremium>
      }
    />

        {/* Manual audit request */}
        <Route path="/request-audit" element={<RequestManualAudit />} />

        {/* SCANNER — PREMIUM ONLY */}
        <Route
          path="/scanner"
          element={
            <RequireAuth>
              <RequirePremium>
                <ScannerPage />
              </RequirePremium>
            </RequireAuth>
          }
        />

        {/* DASHBOARD — AUTH ONLY */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />

         <Route
          path="/billing"
          element={
            <RequireAuth>
              <BillingPage />
            </RequireAuth>
          }
        />

        {/* Dev helper */}
  
        <Route path="/auth/payment/success" element={<PaymentSuccess />} />

        {/* Password */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />

        {/* Legal */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />

        {/* ADMIN */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="/admin/posts/new" element={<PostEditor />} />
          <Route path="/admin/posts/:id" element={<PostEditor />} />
        </Route>
      </Routes>

      {!isAdmin && <Footer />}
    </>
  );
}

const App = () => {
  useEffect(() => {
    AOS.init({ duration: 1000, once: true });
  }, []);

  return (
    
      <Router>
        <ThemeProvider>
          <Toaster
            position="top-center"
            reverseOrder={false}
            toastOptions={{
              duration: 5000,
              style: { background: "#333", color: "#fff", fontSize: "16px" },
            }}
          />
          <AppShell />
        </ThemeProvider>
      </Router>
  
  );
};

export default App;
