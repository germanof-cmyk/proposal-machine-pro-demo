import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PortalLogin() {
  const navigate = useNavigate();
  const { empresa } = useEmpresa();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error("Email ou senha inválidos");
      setLoading(false);
      return;
    }

    // Verify the user is registered as a client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clientUser } = await (supabase.from("client_users") as any)
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!clientUser) {
      await supabase.auth.signOut();
      toast.error("Acesso não autorizado ao portal");
      setLoading(false);
      return;
    }

    navigate("/portal", { replace: true });
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#f5f5f5" }}
    >
      {/* Nav */}
      <nav
        className="h-[52px] px-6 flex items-center gap-3"
        style={{ background: "#0f0f0f" }}
      >
        <div className="w-7 h-7 bg-white rounded flex items-center justify-center">
          <span className="text-black text-[10px] font-bold tracking-tight">3D</span>
        </div>
        <span className="text-white text-sm font-semibold tracking-tight">
          {empresa.nome}
        </span>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">Portal de Fabricação</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {empresa.razao_social}
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="space-y-4 bg-white rounded-xl p-6"
            style={{ border: "0.5px solid #e5e5e5" }}
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Senha
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0f0f0f] hover:bg-[#333] text-white border-0 mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
