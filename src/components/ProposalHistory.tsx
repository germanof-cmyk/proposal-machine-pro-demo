import { Proposal } from "@/types/proposal";

interface Props {
  proposals: Proposal[];
  activeId: string;
  onSelect: (p: Proposal) => void;
  filter?: "todas" | "abertas" | "fechadas";
}

const formatDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
};

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ProposalHistory = ({ proposals, activeId, onSelect, filter = "todas" }: Props) => {
  const filtered = proposals.filter((p) => {
    if (filter === "abertas") return p.status === "aberta";
    if (filter === "fechadas") return p.status === "fechada";
    return true;
  });

  if (filtered.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">
        Nenhuma proposta encontrada
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {filtered.map((p) => {
        const subtotal = p.itens.reduce((s, i) => s + i.qtd * i.valorUnit, 0);
        const total =
          p.status === "fechada" && p.valorFechado > 0
            ? p.valorFechado
            : subtotal - p.desconto + p.frete;
        const isActive = p.id === activeId;

        return (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
              isActive ? "bg-secondary" : "hover:bg-accent"
            }`}
            style={
              isActive
                ? { boxShadow: "inset 0 0 0 0.5px hsl(var(--border))" }
                : undefined
            }
          >
            {/* Line 1: number + date */}
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-semibold">#{p.numero}</span>
              <span className="text-[11px] text-muted-foreground">
                {formatDate(p.emitidoEm)}
              </span>
            </div>

            {/* Line 2: client name */}
            <p className="text-[11px] text-muted-foreground truncate mb-1.5">
              {p.cliente.nome || "Sem cliente"}
            </p>

            {/* Line 3: total + status badge */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {formatCurrency(total)}
              </span>
              {p.status === "fechada" ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "#f0f0f0", color: "#666" }}>
                  Fechada
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                  Aberta
                </span>
              )}
            </div>
            {p.status === "fechada" && p.valorFechado > 0 && (
              <p className="text-[11px] font-medium mt-0.5" style={{ color: "#16a34a" }}>
                ↳ {formatCurrency(p.valorFechado)}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ProposalHistory;
