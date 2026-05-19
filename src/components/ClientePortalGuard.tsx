import { useState, useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function ClientePortalGuard() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user?.email) {
        setHasSession(false);
        setAllowed(false);
        setLoading(false);
        return;
      }
      setHasSession(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("client_users") as any)
        .select("id")
        .eq("email", session.user.email)
        .maybeSingle();
      setAllowed(!!data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    // Representante autenticado tentando acessar o portal → redireciona para o sistema dele
    // Sem sessão → login do portal
    return <Navigate to={hasSession ? "/dashboard" : "/portal/login"} replace />;
  }

  return <Outlet />;
}
