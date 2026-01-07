// src/components/AdminRoute.tsx
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Props = { children: React.ReactNode };

type Role = "admin" | "user" | "premium" | string;

type UserMetaWithRole = {
  role?: Role;
};

function getRoleFromUser(user: { app_metadata?: unknown; user_metadata?: unknown } | null) {
  const appMeta = (user?.app_metadata ?? {}) as UserMetaWithRole;
  const userMeta = (user?.user_metadata ?? {}) as UserMetaWithRole;
  return appMeta.role ?? userMeta.role ?? null;
}

export default function AdminRoute({ children }: Props): React.ReactElement {
  const [checking, setChecking] = useState(true);
  const [ok, setOk] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Ensure session is restored after hard refresh
        await supabase.auth.getSession();

        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;

        const role = getRoleFromUser(user);

        if (mounted) {
          setOk(role === "admin");
          setChecking(false);
        }
      } catch {
        if (mounted) {
          setOk(false);
          setChecking(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return <div className="p-6 text-slate-500">Checking access…</div>;
  }

  if (ok) return <>{children}</>;

  // Preserve target so login can bounce back
  const next = encodeURIComponent(loc.pathname + loc.search);
  return <Navigate to={`/login?next=${next}`} replace />;
}
