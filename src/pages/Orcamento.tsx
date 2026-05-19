import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrcamento } from "@/hooks/useOrcamento";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  Download,
  Trash2,
  PlusCircle,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Link2,
} from "lucide-react";
import { ProcessosCronograma } from "@/components/ProcessosCronograma";
import { CustosProducao } from "@/components/CustosProducao";
import { MateriaisProducao } from "@/components/MateriaisProducao";
import { format, differenceInDays, parseISO, isValid, addDays } from "date-fns";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function safeFormat(
  dateStr: string | null | undefined,
  fmt: string,
  options?: { locale?: typeof ptBR }
): string {
  if (!dateStr) return "—";
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return "—";
    return format(d, fmt, options);
  } catch {
    return "—";
  }
}

const TIPO_LABELS: Record<string, string> = {
  PC: "Pedido de Compra (PC)",
  NF: "Nota Fiscal (NF)",
  outro: "Outros",
};

type TabId = "proposta" | "cronograma" | "arquivos" | "financeiro" | "custos" | "materiais" | "status";

// ─── Component ────────────────────────────────────────────────────────────────

export default function Orcamento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    proposal,
    orcamento,
    arquivos,
    financeiro,
    loading,
    uploading,
    updateOrcamento,
    uploadArquivo,
    downloadArquivo,
    deleteArquivo,
    addParcela,
    updateParcela,
    deleteParcela,
  } = useOrcamento(id!);

  // ── Tab persistence ──────────────────────────────────────────────────────
  const tabKey = `orcamento_tab_${id}`;
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    return (localStorage.getItem(tabKey) as TabId) || "proposta";
  });
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    localStorage.setItem(tabKey, tab);
  };

  // ── Portal token ─────────────────────────────────────────────────────────
  const [portalToken, setPortalToken] = useState<string | null>(null);
  useEffect(() => {
    if (!proposal) return;
    const companyId = (proposal as any).client_company_id;
    if (!companyId) { setPortalToken(null); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("client_companies") as any)
      .select("portal_token")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }: { data: any }) => setPortalToken(data?.portal_token ?? null));
  }, [proposal]);

  // ── Cronograma meta (for header card) ───────────────────────────────────
  const [processosMeta, setProcessosMeta] = useState<{ total: number; concluidos: number }>({ total: 0, concluidos: 0 });
  useEffect(() => {
    if (!orcamento?.id) return;
    supabase
      .from("orcamento_processos")
      .select("id, concluido")
      .eq("orcamento_id", orcamento.id)
      .then(({ data }) => {
        if (!data) return;
        setProcessosMeta({
          total: data.length,
          concluidos: data.filter((p: any) => p.concluido).length,
        });
      });
  }, [orcamento?.id, activeTab]); // refresh when returning to any tab

  // ── Editable fields ──────────────────────────────────────────────────────
  const [localValorFechado, setLocalValorFechado] = useState(0);
  const [localComissao, setLocalComissao] = useState(0);
  const [localPrazo, setLocalPrazo] = useState("");
  const [localPrazoPagamento, setLocalPrazoPagamento] = useState(30);
  const [localNumeroPC, setLocalNumeroPC] = useState("");

  useEffect(() => {
    if (orcamento) {
      setLocalValorFechado(orcamento.valor_fechado);
      setLocalComissao(orcamento.comissao_percent);
      setLocalPrazo(orcamento.prazo_entrega || "");
      setLocalPrazoPagamento(orcamento.prazo_pagamento ?? 30);
      setLocalNumeroPC(orcamento.numero_pc || "");
    }
  }, [orcamento?.id]);

  // ── Derived values ───────────────────────────────────────────────────────
  const progress = useMemo(() => {
    if (!orcamento?.prazo_entrega || !orcamento.created_at) return null;
    const start = new Date(orcamento.created_at).getTime();
    const end = parseISO(orcamento.prazo_entrega).getTime();
    const now = Date.now();
    const pct = Math.round(((now - start) / (end - start)) * 100);
    const dias = differenceInDays(parseISO(orcamento.prazo_entrega), new Date());
    return { pct: Math.min(Math.max(pct, 0), 100), dias, overdue: pct > 100 };
  }, [orcamento?.prazo_entrega, orcamento?.created_at]);

  const progressBarColor = useMemo(() => {
    if (!progress) return "#d1d5db";
    if (progress.overdue) return "#dc2626";
    if (progress.pct >= 80) return "#f87171";
    if (progress.pct >= 60) return "#fbbf24";
    return "#22c55e";
  }, [progress]);

  const diasColor = useMemo(() => {
    if (!progress) return "text-muted-foreground";
    if (progress.overdue) return "text-red-600";
    if (progress.dias <= 7) return "text-amber-600";
    return "text-green-600";
  }, [progress]);

  const comissaoValor = (localValorFechado * localComissao) / 100;
  const totalParcelas = financeiro.reduce((s, p) => s + Number(p.valor), 0);
  const totalRecebido = financeiro.filter((p) => p.recebido).reduce((s, p) => s + Number(p.valor), 0);
  const todasRecebidas = financeiro.length > 0 && financeiro.every((p) => p.recebido);

  const proposalTotal = useMemo(() => {
    if (!proposal) return 0;
    const items = proposal.itens as Array<{ qtd: number; valorUnit: number }>;
    return (
      items.reduce((s, i) => s + i.qtd * i.valorUnit, 0) -
      Number(proposal.desconto) +
      Number(proposal.frete)
    );
  }, [proposal]);

  const clientName = (proposal?.cliente as Record<string, string>)?.nome || "";

  // Previsão de recebimento = prazo_entrega + prazo_pagamento dias
  const previsaoRecebimento = useMemo(() => {
    if (!localPrazo || !localPrazoPagamento) return null;
    try {
      const d = parseISO(localPrazo);
      if (!isValid(d)) return null;
      return addDays(d, localPrazoPagamento);
    } catch { return null; }
  }, [localPrazo, localPrazoPagamento]);

  const cronogramaPct = processosMeta.total > 0
    ? Math.round((processosMeta.concluidos / processosMeta.total) * 100)
    : 0;

  const proposalItens = (proposal?.itens as Array<{ produto: string; qtd: number; valorUnit: number }>) ?? [];

  // ── Loading / not found ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal || !orcamento) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Orçamento não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/app")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  // ── Tab definitions ──────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string; badge?: string }[] = [
    { id: "proposta", label: "Proposta", badge: proposalItens.length > 0 ? String(proposalItens.length) : undefined },
    {
      id: "cronograma",
      label: "Cronograma",
      badge: processosMeta.total > 0 ? `${processosMeta.concluidos}/${processosMeta.total}` : undefined,
    },
    { id: "arquivos", label: "Arquivos", badge: arquivos.length > 0 ? String(arquivos.length) : undefined },
    { id: "financeiro", label: "Financeiro" },
    { id: "custos", label: "Custos" },
    { id: "materiais", label: "Materiais" },
    { id: "status", label: "Status" },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppNav />

      {/* ═══ FIXED HEADER ═══════════════════════════════════════════════════ */}
      <div className="bg-card border-b border-border px-4 sm:px-6 py-4">
        {/* ── Row 1: title + actions ── */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <Link
              to="/app"
              className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-[18px] font-semibold leading-tight">
                Orçamento #{proposal.numero}
              </h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {clientName} · {safeFormat(proposal.emitido_em, "dd/MM/yyyy")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right mr-1">
              <p className="text-[12px] text-muted-foreground">Valor fechado</p>
              <p className="text-[16px] font-bold">{formatCurrency(localValorFechado)}</p>
            </div>
            {(orcamento as any).finalizado && (
              <Badge className="bg-green-600 text-white">Finalizado</Badge>
            )}
            <Badge
              className={
                todasRecebidas && orcamento.material_entregue
                  ? "bg-green-600 text-white"
                  : proposal.status === "fechada"
                  ? "bg-slate-800 text-white"
                  : "bg-amber-500 text-white"
              }
            >
              {todasRecebidas && orcamento.material_entregue
                ? "Concluído"
                : proposal.status === "fechada"
                ? "Fechado"
                : "Aberto"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={!portalToken}
              title={
                !portalToken
                  ? "Vincule esta proposta a uma empresa cliente para gerar o link"
                  : undefined
              }
              onClick={() => {
                if (!portalToken) return;
                const url = `https://centralpropostas.vercel.app/pedidos/${portalToken}`;
                navigator.clipboard.writeText(url).then(() => toast.success("Link copiado!"));
              }}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Link cliente</span>
            </Button>
          </div>
        </div>

        {/* ── Row 2: 4 meta-cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Prazo de entrega */}
          <div
            className="rounded-lg px-3 py-2.5"
            style={{ background: "hsl(var(--muted))" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Prazo de entrega
            </p>
            {localPrazo ? (
              <>
                <p className="text-[13px] font-semibold">
                  {safeFormat(localPrazo, "dd/MM/yyyy")}
                </p>
                {progress && (
                  <p className={`text-[11px] font-medium mt-0.5 ${diasColor}`}>
                    {progress.overdue
                      ? `${Math.abs(progress.dias)}d em atraso`
                      : `${progress.dias}d restantes`}
                  </p>
                )}
                <div className="w-full h-[3px] bg-background rounded-full overflow-hidden mt-1.5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progress?.pct ?? 0}%`, background: progressBarColor }}
                  />
                </div>
              </>
            ) : (
              <p className="text-[12px] text-muted-foreground italic">Não definido</p>
            )}
          </div>

          {/* Cronograma */}
          <div
            className="rounded-lg px-3 py-2.5"
            style={{ background: "hsl(var(--muted))" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Cronograma
            </p>
            {processosMeta.total > 0 ? (
              <>
                <p className="text-[13px] font-semibold">
                  {processosMeta.concluidos} de {processosMeta.total} etapas
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{cronogramaPct}% concluído</p>
                <div className="w-full h-[3px] bg-background rounded-full overflow-hidden mt-1.5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${cronogramaPct}%`, background: "#111" }}
                  />
                </div>
              </>
            ) : (
              <p className="text-[12px] text-muted-foreground italic">Sem etapas</p>
            )}
          </div>

          {/* Pedido de compra */}
          <div
            className="rounded-lg px-3 py-2.5"
            style={{ background: "hsl(var(--muted))" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Pedido de compra
            </p>
            {localNumeroPC ? (
              <p className="text-[13px] font-semibold truncate">{localNumeroPC}</p>
            ) : (
              <p className="text-[12px] font-medium text-amber-600 italic">Aguardando PC</p>
            )}
          </div>

          {/* Previsão de recebimento */}
          <div
            className="rounded-lg px-3 py-2.5"
            style={{ background: "hsl(var(--muted))" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Previsão recebimento
            </p>
            {previsaoRecebimento ? (
              <>
                <p className="text-[13px] font-semibold">
                  {format(previsaoRecebimento, "dd/MM/yyyy", { locale: ptBR })}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  +{localPrazoPagamento}d após entrega
                </p>
              </>
            ) : (
              <p className="text-[12px] text-muted-foreground italic">—</p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ TABS CONTAINER ═════════════════════════════════════════════════ */}
      <main className="flex-1 container max-w-5xl mx-auto px-4 py-6">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Tab nav */}
          <div
            className="flex border-b border-border overflow-x-auto"
            style={{ background: "hsl(var(--muted)/0.5)" }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className="flex items-center gap-1.5 px-4 py-3 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors shrink-0"
                style={{
                  borderBottomColor: activeTab === tab.id ? "#111" : "transparent",
                  color: activeTab === tab.id ? "#111" : "hsl(var(--muted-foreground))",
                  background: activeTab === tab.id ? "hsl(var(--card))" : "transparent",
                }}
              >
                {tab.label}
                {tab.badge && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                    style={{
                      background: activeTab === tab.id ? "#111" : "hsl(var(--border))",
                      color: activeTab === tab.id ? "#fff" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">

            {/* ══ ABA 1: PROPOSTA ═══════════════════════════════════════════ */}
            {activeTab === "proposta" && (
              <div className="space-y-6">
                {/* Dados + Cliente em 2 colunas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Dados do orçamento */}
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Dados do orçamento
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Emissão</Label>
                        <p className="font-medium mt-0.5 text-sm">
                          {safeFormat(proposal.emitido_em, "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Validade</Label>
                        <p className="font-medium mt-0.5 text-sm">
                          {safeFormat(proposal.valido_ate, "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Valor proposta</Label>
                        <p className="font-medium mt-0.5 text-sm">{formatCurrency(proposalTotal)}</p>
                      </div>
                      <div>
                        <Label htmlFor="valor_fechado" className="text-xs text-muted-foreground">
                          Valor fechado
                        </Label>
                        <Input
                          id="valor_fechado"
                          type="number"
                          step="0.01"
                          value={localValorFechado}
                          onChange={(e) => setLocalValorFechado(Number(e.target.value))}
                          onBlur={() => updateOrcamento({ valor_fechado: localValorFechado })}
                          className="h-8 text-sm mt-0.5"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="prazo_entrega" className="text-xs text-muted-foreground">
                          Prazo de entrega
                        </Label>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Input
                            id="prazo_entrega"
                            type="date"
                            value={localPrazo}
                            onChange={(e) => {
                              setLocalPrazo(e.target.value);
                              updateOrcamento({ prazo_entrega: e.target.value || null });
                            }}
                            className="h-8 text-sm w-40"
                          />
                          {progress && (
                            <span className={`text-xs font-medium ${diasColor}`}>
                              {progress.overdue
                                ? `${Math.abs(progress.dias)}d em atraso`
                                : `${progress.dias}d restantes`}
                            </span>
                          )}
                        </div>
                        {localPrazo && progress && (
                          <div className="mt-2">
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${progress.pct}%`, background: progressBarColor }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {progress.pct}% do prazo decorrido
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="numero_pc" className="text-xs text-muted-foreground">
                          Nº do Pedido de Compra
                        </Label>
                        <Input
                          id="numero_pc"
                          type="text"
                          value={localNumeroPC}
                          onChange={(e) => setLocalNumeroPC(e.target.value)}
                          onBlur={() =>
                            updateOrcamento({ numero_pc: localNumeroPC || null } as any)
                          }
                          placeholder="Ex: PC-4500211200"
                          className="h-8 text-sm mt-0.5"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cliente */}
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Cliente
                    </h3>
                    {(() => {
                      const c = proposal.cliente as Record<string, string>;
                      const fields = [
                        { label: "Nome", key: "nome" },
                        { label: "Telefone", key: "telefone" },
                        { label: "Email", key: "email" },
                        { label: "CPF/CNPJ", key: "cpfCnpj" },
                        { label: "Endereço", key: "endereco" },
                        { label: "Cidade / Estado", value: [c.cidade, c.estado].filter(Boolean).join(" / ") },
                      ];
                      return (
                        <div className="grid grid-cols-2 gap-3">
                          {fields.map((f) => {
                            const val = f.value ?? c[f.key!];
                            if (!val) return null;
                            return (
                              <div key={f.label} className={f.label === "Nome" ? "col-span-2" : ""}>
                                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                                <p className="font-medium mt-0.5 text-sm">{val}</p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Itens */}
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Itens
                  </h3>
                  {proposalItens.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum item</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto / Serviço</TableHead>
                            <TableHead className="w-20 text-right">Qtd</TableHead>
                            <TableHead className="w-32 text-right">Vlr Unit.</TableHead>
                            <TableHead className="w-32 text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {proposalItens.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-sm">{item.produto || "—"}</TableCell>
                              <TableCell className="text-right text-sm">{item.qtd}</TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(item.valorUnit)}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {formatCurrency(item.qtd * item.valorUnit)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="flex justify-end gap-6 px-4 py-2.5 border-t bg-muted/30 text-sm">
                        {Number(proposal.desconto) > 0 && (
                          <span className="text-muted-foreground">
                            Desconto: <span className="font-medium text-red-600">−{formatCurrency(Number(proposal.desconto))}</span>
                          </span>
                        )}
                        {Number(proposal.frete) > 0 && (
                          <span className="text-muted-foreground">
                            Frete: <span className="font-medium">{formatCurrency(Number(proposal.frete))}</span>
                          </span>
                        )}
                        <span className="font-bold">Total: {formatCurrency(proposalTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══ ABA 2: CRONOGRAMA ════════════════════════════════════════ */}
            {activeTab === "cronograma" && (
              <ProcessosCronograma
                orcamentoId={orcamento.id}
                dataInicioProducao={orcamento.data_inicio_producao ?? null}
                onUpdateDataInicio={(date) =>
                  updateOrcamento({ data_inicio_producao: date })
                }
              />
            )}

            {/* ══ ABA 3: ARQUIVOS ══════════════════════════════════════════ */}
            {activeTab === "arquivos" && (
              <div className="space-y-4">
                {(["PC", "NF", "outro"] as const).map((tipo) => {
                  const tipoArquivos = arquivos.filter((a) => a.tipo === tipo);
                  return (
                    <div key={tipo} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium">{TIPO_LABELS[tipo]}</h4>
                        <label className="cursor-pointer">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs pointer-events-none"
                            disabled={uploading}
                          >
                            <span>
                              {uploading ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                              ) : (
                                <Upload className="w-3.5 h-3.5 mr-1" />
                              )}
                              Enviar arquivo
                            </span>
                          </Button>
                          <input
                            type="file"
                            className="hidden"
                            disabled={uploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                uploadArquivo(file, tipo);
                                e.target.value = "";
                              }
                            }}
                          />
                        </label>
                      </div>
                      {tipoArquivos.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum arquivo enviado</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {tipoArquivos.map((arq) => (
                            <li
                              key={arq.id}
                              className="flex items-center justify-between bg-muted rounded-md px-3 py-1.5"
                            >
                              <span className="text-sm truncate max-w-xs">{arq.nome}</span>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => downloadArquivo(arq)}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir arquivo?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        "{arq.nome}" será removido permanentemente.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive hover:bg-destructive/90"
                                        onClick={() => deleteArquivo(arq)}
                                      >
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ══ ABA 4: FINANCEIRO ════════════════════════════════════════ */}
            {activeTab === "financeiro" && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Total</p>
                    <p className="text-xl font-bold">{formatCurrency(localValorFechado)}</p>
                  </div>
                  <div>
                    <Label htmlFor="comissao" className="text-xs text-muted-foreground">
                      Comissão (%)
                    </Label>
                    <Input
                      id="comissao"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={localComissao}
                      onChange={(e) => setLocalComissao(Number(e.target.value))}
                      onBlur={() => updateOrcamento({ comissao_percent: localComissao })}
                      className="mt-0.5 h-8 w-24"
                    />
                  </div>
                  <div>
                    <Label htmlFor="prazo_pagamento" className="text-xs text-muted-foreground">
                      Prazo pagamento (dias)
                    </Label>
                    <Input
                      id="prazo_pagamento"
                      type="number"
                      min="0"
                      value={localPrazoPagamento}
                      onChange={(e) => setLocalPrazoPagamento(Number(e.target.value))}
                      onBlur={() => updateOrcamento({ prazo_pagamento: localPrazoPagamento })}
                      className="mt-0.5 h-8 w-24"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Comissão</p>
                    <p className="text-xl font-semibold text-blue-600">
                      {formatCurrency(comissaoValor)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Recebido</p>
                    <p className="text-xl font-semibold text-green-600">
                      {formatCurrency(totalRecebido)}
                    </p>
                    {financeiro.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {financeiro.filter((p) => p.recebido).length}/{financeiro.length} parcelas
                      </p>
                    )}
                  </div>
                </div>

                {/* Parcelas */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium">Parcelas</h4>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addParcela}>
                      <PlusCircle className="w-3.5 h-3.5 mr-1" />
                      Adicionar parcela
                    </Button>
                  </div>
                  {financeiro.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhuma parcela cadastrada
                    </p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Parcela</TableHead>
                            <TableHead>Valor (R$)</TableHead>
                            <TableHead>Data Prevista</TableHead>
                            <TableHead className="w-24 text-center">Recebido</TableHead>
                            <TableHead>Data Recebimento</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {financeiro.map((p) => (
                            <TableRow
                              key={p.id}
                              className={p.recebido ? "bg-green-50 dark:bg-green-950/20" : ""}
                            >
                              <TableCell className="font-medium">{p.parcela}ª</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  defaultValue={p.valor}
                                  onBlur={(e) =>
                                    updateParcela(p.id, { valor: Number(e.target.value) })
                                  }
                                  className="h-7 w-28 text-sm"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="date"
                                  defaultValue={p.data_prevista || ""}
                                  onBlur={(e) =>
                                    updateParcela(p.id, {
                                      data_prevista: e.target.value || null,
                                    })
                                  }
                                  className="h-7 w-36 text-sm"
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={p.recebido}
                                  onCheckedChange={(checked) =>
                                    updateParcela(p.id, {
                                      recebido: !!checked,
                                      data_recebimento: checked
                                        ? new Date().toISOString().slice(0, 10)
                                        : null,
                                    })
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                {p.recebido && (
                                  <Input
                                    type="date"
                                    defaultValue={p.data_recebimento || ""}
                                    onBlur={(e) =>
                                      updateParcela(p.id, {
                                        data_recebimento: e.target.value || null,
                                      })
                                    }
                                    className="h-7 w-36 text-sm"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteParcela(p.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {financeiro.length > 0 && (
                    <div className="flex justify-end mt-2 text-sm text-muted-foreground">
                      Total parcelas:{" "}
                      <span className="font-medium ml-1">{formatCurrency(totalParcelas)}</span>
                      {Math.abs(totalParcelas - localValorFechado) > 0.01 && (
                        <span className="ml-2 text-amber-600">
                          (diferença de{" "}
                          {formatCurrency(Math.abs(totalParcelas - localValorFechado))} do valor
                          fechado)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══ ABA 5: CUSTOS ════════════════════════════════════════════ */}
            {activeTab === "custos" && (
              <CustosProducao
                orcamentoId={orcamento.id}
                proposalItens={proposalItens}
              />
            )}

            {/* ══ ABA 6: MATERIAIS ═════════════════════════════════════════ */}
            {activeTab === "materiais" && (
              <MateriaisProducao
                orcamentoId={orcamento.id}
                proposalItens={proposalItens}
              />
            )}

            {/* ══ ABA 7: STATUS ════════════════════════════════════════════ */}
            {activeTab === "status" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Material Entregue</p>
                    {orcamento.material_entregue && orcamento.material_entregue_em && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Em{" "}
                        {safeFormat(orcamento.material_entregue_em, "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={orcamento.material_entregue}
                    onCheckedChange={(checked) =>
                      updateOrcamento({
                        material_entregue: checked,
                        material_entregue_em: checked
                          ? new Date().toISOString().slice(0, 10)
                          : null,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Valor Recebido</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {financeiro.filter((p) => p.recebido).length} de {financeiro.length} parcelas
                      recebidas · {formatCurrency(totalRecebido)} de{" "}
                      {formatCurrency(localValorFechado)}
                    </p>
                  </div>
                  {todasRecebidas ? (
                    <Badge className="bg-green-600 gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Recebido
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pendente</Badge>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
