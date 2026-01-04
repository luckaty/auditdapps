// src/components/RequireAuth.tsx
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

type RequireAuthProps = {
  children: ReactElement;
};

export function RequireAuth({ children }: RequireAuthProps) {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        setAuthed(!!data?.user);
      } catch (e) {
        if (!cancelled) {
          console.error("[RequireAuth] auth check error:", e);
          setAuthed(false);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-sm text-muted-foreground">
        Checking your session…
      </div>
    );
  }

  if (!authed) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
