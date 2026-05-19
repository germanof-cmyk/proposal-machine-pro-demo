import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Proposal } from "@/types/proposal";
import { useProposals } from "@/hooks/useProposals";
import { useClients } from "@/hooks/useClients";
import ProposalForm from "@/components/ProposalForm";
import ProposalPreview from "@/components/ProposalPreview";
import ProposalHistory from "@/components/ProposalHistory";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Save, Loader2, CheckCircle2, ClipboardList, Eye, Edit3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
};

const TABS = [
  { value: "todas", label: "Todas" },
  { value: "abertas", label: "Abertas" },
  { value: "fechadas", label: "Fechadas" },
] as const;

const Index = () => {
  const navigate = useNavigate();
  const { proposals, loading, saveProposal, getNextNumber } = useProposals();
  const { saveClient, searchByName } = useClients();
  const [current, setCurrent] = useState<Proposal | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"todas" | "abertas" | "fechadas">("todas");
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [valorFechado, setValorFechado] = useState(0);

  // Client company linkage
  const [companies, setCompanies] = useState<{ id: string; nome: string }[]>([]);
  const [currentCompanyId, setCurrentCompanyId] = useState<string>("");

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("client_companies") as any)
      .select("id, nome")
      .order("nome")
      .then(({ data }: { data: any[] | null }) => {
        setCompanies((data || []) as { id: string; nome: string }[]);
      });
  }, []);

  useEffect(() => {
    if (!current?.id) { setCurrentCompanyId(""); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("proposals") as any)
      .select("client_company_id")
      .eq("id", current.id)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        setCurrentCompanyId(data?.client_company_id ?? "");
      });
  }, [current?.id]);

  const handleCompanyChange = async (companyId: string) => {
    if (!current?.id) return;
    setCurrentCompanyId(companyId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("proposals") as any)
      .update({ client_company_id: companyId || null })
      .eq("id", current.id);
  };

  const createEmpty = (): Proposal => ({
    id: crypto.randomUUID(),
    numero: getNextNumber(),
    emitidoEm: new Date().toISOString().slice(0, 10),
    validoAte: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    cliente: { nome: "", telefone: "", email: "", cpfCnpj: "", rgIe: "", endereco: "", bairro: "", cidade: "", estado: "", cep: "" },
    itens: [{ id: "1", produto: "", qtd: 1, valorUnit: 0 }],
    desconto: 0,
    frete: 0,
    formaPagamento: "",
    observacoesFrete: "",
    outrasObservacoes: "",
    criadoPor: "Dhiego Michels Decker",
    status: "aberta",
    valorFechado: 0,
  });

  if (!current && proposals.length > 0) {
    setCurrent(proposals[0]);
  }

  const handleSave = async () => {
    if (!current) return;
    setSaving(true);
    const saved = await saveProposal(current);
    if (saved) {
      setCurrent(saved);
      if (current.cliente.nome.trim()) {
        saveClient(current.cliente);
      }
    }
    setSaving(false);
  };

  const handlePrint = () => {
    setView("preview");
    setTimeout(() => window.print(), 300);
  };

  const handleNew = () => {
    setCurrent(createEmpty());
    setView("edit");
  };

  const handleOpenCloseDialog = () => {
    if (!current) return;
    const subtotal = current.itens.reduce((s, i) => s + i.qtd * i.valorUnit, 0);
    const total = subtotal - current.desconto + current.frete;
    setValorFechado(total);
    setShowCloseDialog(true);
  };

  const handleCloseProposal = async () => {
    if (!current) return;
    const updated = { ...current, status: "fechada" as const, valorFechado };
    setSaving(true);
    const saved = await saveProposal(updated);
    if (saved) setCurrent(saved);
    setSaving(false);
    setShowCloseDialog(false);
  };

  const handleReopenProposal = async () => {
    if (!current) return;
    const updated = { ...current, status: "aberta" as const, valorFechado: 0 };
    setSaving(true);
    const saved = await saveProposal(updated);
    if (saved) setCurrent(saved);
    setSaving(false);
  };

  const currentTotal = current
    ? current.itens.reduce((s, i) => s + i.qtd * i.valorUnit, 0) - current.desconto + current.frete
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppNav />

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className="no-print w-[220px] bg-card shrink-0 flex flex-col"
          style={{ borderRight: "0.5px solid hsl(var(--border))" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "0.5px solid hsl(var(--border))" }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Histórico
            </span>
            <button
              onClick={handleNew}
              className="text-[11px] font-medium px-2 py-1 rounded bg-foreground text-background hover:opacity-80 transition-opacity"
            >
              + Nova
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-3 pt-2 pb-1 gap-0.5">
            {TABS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setHistoryFilter(value)}
                className={`flex-1 text-[11px] py-1.5 rounded transition-colors ${
                  historyFilter === value
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-2 py-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : proposals.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Nenhuma proposta
              </p>
            ) : (
              <ProposalHistory
                proposals={proposals}
                activeId={current?.id || ""}
                onSelect={(p) => { setCurrent(p); setView("edit"); }}
                filter={historyFilter}
              />
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-h-screen">
          {/* Header / toolbar */}
          <header
            className="no-print bg-card px-6 py-3.5 flex items-center gap-4"
            style={{ borderBottom: "0.5px solid hsl(var(--border))" }}
          >
            {/* Left: proposal info */}
            <div className="flex-1 min-w-0">
              {current ? (
                <>
                  <div className="text-[18px] font-medium leading-tight">
                    Proposta #{current.numero}
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-0.5">
                    {current.cliente.nome || "Sem cliente"}
                    {current.emitidoEm ? ` · ${formatDate(current.emitidoEm)}` : ""}
                  </div>
                </>
              ) : (
                <div className="text-[18px] font-medium text-muted-foreground">
                  Nenhuma proposta selecionada
                </div>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setView(view === "edit" ? "preview" : "edit")}
                className="h-8 text-xs"
              >
                {view === "edit" ? (
                  <><Eye className="w-3.5 h-3.5 mr-1.5" />Visualizar</>
                ) : (
                  <><Edit3 className="w-3.5 h-3.5 mr-1.5" />Editar</>
                )}
              </Button>

              {current && current.status === "fechada" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/app/orcamento/${current.id}`)}
                  className="h-8 text-xs"
                >
                  <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                  Ver Orçamento
                </Button>
              )}

              {current && current.status === "aberta" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenCloseDialog}
                  className="h-8 text-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Fechar
                </Button>
              )}

              {current && current.status === "fechada" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReopenProposal}
                  className="h-8 text-xs"
                >
                  Reabrir
                </Button>
              )}

              <Button
                size="sm"
                onClick={handleSave}
                disabled={!current || saving}
                className="h-8 text-xs bg-[#1a1a1a] hover:bg-[#333] text-white border-0"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                )}
                Salvar
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={handlePrint}
                className="h-8 text-xs text-muted-foreground"
              >
                Imprimir
              </Button>
            </div>
          </header>

          {/* Company linkage bar */}
          {current && companies.length > 0 && (
            <div
              className="no-print bg-card px-6 py-2 flex items-center gap-3"
              style={{ borderBottom: "0.5px solid hsl(var(--border))" }}
            >
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Empresa cliente:
              </span>
              <select
                value={currentCompanyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="h-7 text-xs border border-input rounded-md px-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Sem vínculo</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Closed proposal banner */}
          {current && current.status === "fechada" && (
            <div
              className="no-print px-6 py-2 flex items-center gap-3"
              style={{ borderBottom: "0.5px solid hsl(var(--border))", background: "hsl(var(--card))" }}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Proposta Fechada</span>
              <span className="text-xs text-muted-foreground">
                Valor proposta: {formatCurrency(currentTotal)} · Valor fechado:{" "}
                <strong className="text-foreground">{formatCurrency(current.valorFechado)}</strong>
              </span>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {!current ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">Selecione ou crie uma nova proposta</p>
              </div>
            ) : view === "edit" ? (
              <div
                className="max-w-2xl mx-auto bg-card rounded-xl p-6"
                style={{ border: "0.5px solid hsl(var(--border))" }}
              >
                <ProposalForm
                  proposal={current}
                  onChange={setCurrent}
                  searchClients={searchByName}
                />
              </div>
            ) : (
              <ProposalPreview proposal={current} />
            )}
          </div>
        </main>
      </div>

      {/* Close Proposal Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fechar Proposta #{current?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-secondary rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor total da proposta:</span>
                <span className="font-semibold">{formatCurrency(currentTotal)}</span>
              </div>
            </div>
            <div>
              <Label className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Valor fechado (R$)
              </Label>
              <Input
                type="number"
                value={valorFechado}
                onChange={(e) => setValorFechado(Number(e.target.value))}
                className="mt-1.5"
                placeholder="Valor negociado final"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Informe o valor final acordado com o cliente
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCloseProposal}
              disabled={saving}
              className="bg-[#1a1a1a] hover:bg-[#333] text-white border-0"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Confirmar Fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
