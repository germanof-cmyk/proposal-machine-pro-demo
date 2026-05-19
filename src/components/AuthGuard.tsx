import { useState, useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function AuthGuard() {
  const { user, loading: authLoading } = useAuth();
  const [isClientUser, setIsClientUser] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.email) {
      setIsClientUser(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("client_users") as any)
      .select("id")
      .eq("email", user.email)
      .maybeSingle()
      .then(({ data }: { data: { id: string } | null }) => {
        setIsClientUser(!!data);
      });
  }, [user, authLoading]);

  if (authLoading || isClientUser === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Usuário cliente não pode acessar rotas do representante
  if (isClientUser) {
    return <Navigate to="/portal" replace />;
  }

  return <Outlet />;
}
