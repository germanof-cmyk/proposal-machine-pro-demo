import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-frotaly.png";

const NAV_LINKS = [
  { to: "/app", label: "Propostas" },
  { to: "/app/dashboard", label: "Dashboard" },
  { to: "/app/configuracoes", label: "Configurações" },
];

export function AppNav() {
  const { user, signOut } = useAuth();
  const { empresa } = useEmpresa();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div
      className="no-print bg-white h-[52px] px-6 flex items-center gap-8"
      style={{ borderBottom: "0.5px solid hsl(var(--border))" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0">
        <img src={logo} alt="Frotaly" style={{ height: 32, width: "auto" }} />
        <span className="text-sm font-semibold tracking-tight">{empresa.nome}</span>
      </div>

      {/* Center nav */}
      <nav className="flex items-center gap-0.5">
        {NAV_LINKS.map(({ to, label }) => {
          const isActive = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                isActive
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {user && (
        <span className="text-xs text-muted-foreground hidden sm:block">{user.email}</span>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="h-7 text-xs text-muted-foreground"
      >
        Sair
      </Button>
    </div>
  );
}
