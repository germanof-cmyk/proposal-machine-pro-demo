import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Clock, DollarSign, Check, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, Download, FileText,
} from "lucide-react";
import { format, parseISO, differenceInDays, isValid, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function safeFormat(dateStr: string | null | undefined, fmt: string): string {
  if (!dateStr) return "—";
  try {
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, fmt, { locale: ptBR }) : "—";
  } catch { return "—"; }
}

function daysColor(dias: number | null): string {
  if (dias === null) return "#9ca3af";
  if (dias < 0 || dias <= 3) return "#dc2626";
  if (dias <= 7) return "#d97706";
  return "#16a34a";
}

const TIPO_ICON_COLOR: Record<string, string> = {
  PC: "#d97706", NF: "#16a34a", outro: "#7c3aed", outros: "#7c3aed",
};
const TIPO_LABEL: Record<string, string> = {
  PC: "PC", NF: "NF", outro: "Outro", outros: "Outro",
};

interface ProposalRow {
  id: string; numero: string; emitido_em: string; status: string;
  valor_fechado: number; cliente: Record<string, string>;
  itens: Array<{ qtd: number; valorUnit: number }>; desconto: number; frete: number;
}
interface OrcamentoRow {
  id: string; proposal_id: string; valor_fechado: number;
  prazo_entrega: string | null; material_entregue: boolean; created_at: string;
  numero_pc: string | null;
  proposals: { numero: string; cliente: Record<string, string>; itens: any[] };
}
interface FinanceiroRow {
  id: string; parcela: number; valor: number; data_prevista: string | null; recebido: boolean;
  orcamentos: { proposal_id: string; proposals: { numero: string; cliente: Record<string, string> } };
}
interface ProcessoRow {
  id: string; orcamento_id: string; nome: string; dias: number | null;
  ordem: number; concluido: boolean; concluido_em: string | null;
}
interface ArquivoRow {
  id: string; orcamento_id: string; tipo: string; nome: string;
  storage_path: string; publicUrl: string;
}

interface ItemProducao {
  id: string; orcamento_id: string; item_index: number;
  item_nome: string; quantidade_total: number; quantidade_produzida: number;
}

async function fetchItensProducao(orcamentoId: string): Promise<ItemProducao[]> {
  const { data, error } = await supabase
    .from("orcamento_itens_producao" as any)
    .select("id, orcamento_id, item_index, item_nome, quantidade_total, quantidade_produzida")
    .eq("orcamento_id", orcamentoId)
    .order("item_index");
  if (error) console.error('[PecasTab] Erro ao buscar itens producao:', error);
  return (data ?? []) as ItemProducao[];
}

function PecasTabDash({ itensProducao }: { itensProducao: ItemProducao[] }) {
  const totalTotal = itensProducao.reduce((s, ip) => s + ip.quantidade_total, 0);
  const totalProd = itensProducao.reduce((s, ip) => s + ip.quantidade_produzida, 0);
  const totalRest = totalTotal - totalProd;
  const pct = totalTotal > 0 ? Math.round((totalProd / totalTotal) * 100) : 0;
  if (itensProducao.length === 0) {
    return <div className="px-5 py-4"><p className="text-xs text-muted-foreground italic">Nenhuma peça registrada</p></div>;
  }
  return (
    <div className="px-5 py-4 space-y-3">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
        {[
          { label: "Total", value: totalTotal, color: "#111" },
          { label: "Produzidas", value: totalProd, color: "#16a34a" },
          { label: "Restantes", value: totalRest, color: totalRest > 0 ? "#d97706" : "#16a34a" },
        ].map(k => (
          <div key={k.label} style={{ background: "#f9f9f8", border: "0.5px solid #ebebeb", borderRadius: "8px", padding: "8px 10px" }}>
            <p style={{ fontSize: "9px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#aaa", marginBottom: "2px" }}>{k.label}</p>
            <p style={{ fontSize: "20px", fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span style={{ fontSize: "10px", color: "#aaa" }}>Progresso</span>
          <span style={{ fontSize: "10px", fontWeight: 600, color: "#111" }}>{pct}%</span>
        </div>
        <div style={{ width: "100%", height: "5px", background: "#f0f0f0", borderRadius: "99px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#111", borderRadius: "99px" }} />
        </div>
      </div>
      <div style={{ borderTop: "0.5px solid #f0f0f0", paddingTop: "8px" }}>
        {itensProducao.map(ip => (
          <div key={ip.id} style={{ display: "flex", alignItems: "center", padding: "5px 0", borderBottom: "0.5px solid #f8f8f8", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "#333", flex: 1 }}>{ip.item_nome}</span>
            <span style={{ fontSize: "11px", color: "#aaa" }}>/{ip.quantidade_total}</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#111", minWidth: "28px", textAlign: "right" }}>{ip.quantidade_produzida}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getProposalTotal(p: ProposalRow): number {
  return p.itens.reduce((s, i) => s + i.qtd * i.valorUnit, 0) - Number(p.desconto) + Number(p.frete);
}

function buildMonthOptions() {
  const opts: { label: string; value: string }[] = [{ label: "Todos os meses", value: "todos" }];
  for (let i = 0; i < 13; i++) {
    const d = subMonths(new Date(), i);
    opts.push({ label: format(d, "MMMM yyyy", { locale: ptBR }), value: format(d, "yyyy-MM") });
  }
  return opts;
}

type KpiKey = "abertas" | "fechadas" | "areceber";

// ─── KPI Card ────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  borderColor: string;
  kpiKey: KpiKey;
  activeKpi: KpiKey | null;
  onToggle: (k: KpiKey) => void;
}
function KpiCard({ label, value, subtitle, icon, iconBg, borderColor, kpiKey, activeKpi, onToggle }: KpiCardProps) {
  const active = activeKpi === kpiKey;
  return (
    <button
      onClick={() => onToggle(kpiKey)}
      className="w-full text-left bg-white rounded-xl flex flex-col transition-colors"
      style={{
        border: active ? `0.5px solid ${borderColor}` : "0.5px solid #e5e5e5",
        borderLeft: `3px solid ${borderColor}`,
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = "#bbb"; (e.currentTarget as HTMLElement).style.borderLeftColor = borderColor; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = active ? borderColor : "#e5e5e5"; (e.currentTarget as HTMLElement).style.borderLeftColor = borderColor; }}
    >
      <div className="px-4 pt-4 pb-3 flex-1">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}>
            {icon}
          </div>
        </div>
        <div className="text-[28px] font-bold leading-none mt-1">{value}</div>
        <div className="text-[12px] text-muted-foreground mt-1">{subtitle}</div>
      </div>
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ borderTop: "0.5px solid #f0f0f0" }}
      >
        <span className="text-[11px] font-medium" style={{ color: borderColor }}>
          {active ? "Fechar ↑" : "Ver →"}
        </span>
        {active ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </div>
    </button>
  );
}

// ─── Orcamento Card ───────────────────────────────────────────────────────────
interface OrcamentoCardProps {
  orc: OrcamentoRow;
  processos: ProcessoRow[];
  arquivos: ArquivoRow[];
  expanded: boolean;
  onToggle: () => void;
  itensProducao: ItemProducao[];
}
function OrcamentoCard({ orc, processos, arquivos, expanded, onToggle, itensProducao }: OrcamentoCardProps) {
  const clientName = orc.proposals?.cliente?.nome || "—";
  const numero = orc.proposals?.numero || "—";

  const done = processos.filter(p => p.concluido).length;
  const total = processos.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const andamentoIdx = processos.findIndex(p => !p.concluido);
  const [activeTab, setActiveTab] = useState<"cronograma" | "pecas" | "documentos">("cronograma");

  const dias = orc.prazo_entrega
    ? (() => { try { return differenceInDays(parseISO(orc.prazo_entrega), new Date()); } catch { return null; } })()
    : null;
  const dColor = daysColor(dias);

  return (
    <div
      className="bg-white rounded-xl overflow-hidden transition-colors"
      style={{ border: expanded ? "0.5px solid #bbb" : "0.5px solid #e5e5e5" }}
    >
      {/* Header — always visible */}
      <button
        className="w-full text-left px-5 py-4"
        onClick={onToggle}
        onMouseEnter={e => { if (!expanded) (e.currentTarget.parentElement as HTMLElement).style.borderColor = "#bbb"; }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget.parentElement as HTMLElement).style.borderColor = "#e5e5e5"; }}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: info + progress */}
          <div className="flex-1 min-w-0">
            {orc.numero_pc ? (
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111' }}>
                  <span style={{ fontSize: '11px', fontWeight: 400, color: '#aaa' }}>PC · </span>
                  {orc.numero_pc}
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>Orç. #{numero}</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '13px', color: '#b45309', fontStyle: 'italic' }}>Aguardando pedido de compra</div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>Orç. #{numero}</div>
              </div>
            )}
            <span className="text-[13px] text-muted-foreground truncate">{clientName}</span>

            {total > 0 && (
              <div className="mt-2.5">
                <div className="w-full h-[4px] bg-[#f0f0f0] rounded-full overflow-hidden">
                  <div className="h-full bg-[#111] rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  {done} de {total} etapas · {pct}%
                </span>
              </div>
            )}
          </div>

          {/* Right: dias + date + chevron */}
          <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-2">
              {dias !== null && (
                <span className="text-[26px] font-bold leading-none" style={{ color: dColor }}>
                  {Math.abs(dias)}
                </span>
              )}
              {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
            {dias !== null && (
              <span className="text-[11px] font-medium" style={{ color: dColor }}>
                {dias < 0 ? "dias atrasado" : "dias restantes"}
              </span>
            )}
            {orc.prazo_entrega && (
              <span className="text-[11px] text-muted-foreground">
                {safeFormat(orc.prazo_entrega, "dd/MM/yyyy")}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <>
          {/* Tab bar */}
          <div style={{ borderTop: "0.5px solid #f0f0f0", display: "flex", padding: "0 20px", gap: "4px" }}>
            {(["cronograma", "pecas", "documentos"] as const).map(tab => (
              <button
                key={tab}
                onClick={e => { e.stopPropagation(); setActiveTab(tab); }}
                style={{
                  fontSize: "11px", fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? "#111" : "#aaa",
                  padding: "9px 12px 8px", background: "none", border: "none",
                  borderBottom: activeTab === tab ? "2px solid #111" : "2px solid transparent",
                  cursor: "pointer", transition: "color 0.15s",
                }}
              >
                {tab === "cronograma" ? "Cronograma" : tab === "pecas" ? "Peças" : "Documentos"}
              </button>
            ))}
          </div>

          {activeTab === "cronograma" && (
          <div className="px-5 py-4">
            {processos.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma etapa cadastrada</p>
            ) : (
              <div>
                {processos.map((p, idx) => {
                  const isAndamento = idx === andamentoIdx;
                  const isFirst = idx === 0;
                  const isLast = idx === processos.length - 1;
                  const prevConcluido = idx === 0 || processos[idx - 1].concluido;

                  const nodeStyle = p.concluido
                    ? { background: "#111", borderColor: "#111" }
                    : isAndamento
                    ? { background: "#2563eb", borderColor: "#2563eb" }
                    : { background: "#fff", borderColor: "#d1d5db" };

                  const lineAbove = p.concluido && prevConcluido ? "#374151" : "#e5e7eb";
                  const lineBelow = p.concluido ? "#374151" : "#e5e7eb";

                  return (
                    <div key={p.id} className="flex gap-2.5">
                      {/* Timeline col */}
                      <div className="flex flex-col items-center w-5 shrink-0">
                        {!isFirst && <div className="w-px h-2.5 shrink-0" style={{ background: lineAbove }} />}
                        <div
                          className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                          style={nodeStyle}
                        >
                          {p.concluido && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                          {isAndamento && !p.concluido && (
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        {!isLast && <div className="w-px flex-1 min-h-[20px]" style={{ background: lineBelow }} />}
                      </div>

                      {/* Content col */}
                      <div className="flex-1 pb-3 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[12px] leading-tight ${p.concluido ? "line-through text-muted-foreground" : "font-medium"}`}>
                            {p.nome}
                          </span>
                          {p.concluido ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#f0fdf4", color: "#16a34a" }}>Feito</span>
                          ) : isAndamento ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#eff6ff", color: "#2563eb" }}>Andamento</span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#f5f5f5", color: "#666" }}>Pendente</span>
                          )}
                        </div>
                        {p.dias != null && (
                          <span className="text-[11px] text-muted-foreground">{p.dias} {p.dias === 1 ? "dia" : "dias"}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {activeTab === "pecas" && (
            <PecasTabDash itensProducao={itensProducao} />
          )}

          {activeTab === "documentos" && (
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Arquivos
              </p>
              {arquivos.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum arquivo anexado ainda</p>
              ) : (
                <div className="space-y-1.5">
                  {arquivos.map(arq => {
                    const iconColor = TIPO_ICON_COLOR[arq.tipo] ?? "#7c3aed";
                    const tipoLabel = TIPO_LABEL[arq.tipo] ?? arq.tipo;
                    return (
                      <div
                        key={arq.id}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                        style={{ background: "#f9f9f8", border: "0.5px solid #ebebeb" }}
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium truncate">{arq.nome}</p>
                          <p className="text-[10px] text-muted-foreground">{tipoLabel}</p>
                        </div>
                        <a
                          href={arq.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-1 rounded hover:bg-blue-50 transition-colors"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5 text-blue-600" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div
            className="px-5 py-3 flex justify-end"
            style={{ borderTop: "0.5px solid #f0f0f0" }}
          >
            <Link
              to={`/app/orcamento/${orc.proposal_id}`}
              onClick={e => e.stopPropagation()}
              className="text-[12px] font-medium px-4 py-2 rounded-lg text-white transition-colors"
              style={{ background: "#111" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#333")}
              onMouseLeave={e => (e.currentTarget.style.background = "#111")}
            >
              Abrir orçamento completo →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ─── KPI Expanded Sections ───────────────────────────────────────────────────
function TableHeader({ cols }: { cols: string[] }) {
  return (
    <div
      className="grid px-4 py-2"
      style={{
        gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
        borderBottom: "0.5px solid #e5e5e5",
        background: "#fafafa",
      }}
    >
      {cols.map(c => (
        <span key={c} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{c}</span>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [orcamentos, setOrcamentos] = useState<OrcamentoRow[]>([]);
  const [financeiro, setFinanceiro] = useState<FinanceiroRow[]>([]);
  const [processosByOrc, setProcessosByOrc] = useState<Record<string, ProcessoRow[]>>({});
  const [arquivosByOrc, setArquivosByOrc] = useState<Record<string, ArquivoRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState("todos");
  const [activeKpi, setActiveKpi] = useState<KpiKey | null>(null);
  const [expandedOrcId, setExpandedOrcId] = useState<string | null>(null);
  const [itensProducaoMap, setItensProducaoMap] = useState<Record<string, ItemProducao[]>>({});
  const loadingItensRef = useRef<Set<string>>(new Set());
  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const handleToggleCard = useCallback(async (orc: OrcamentoRow) => {
    const isOpening = expandedOrcId !== orc.id;
    setExpandedOrcId(prev => prev === orc.id ? null : orc.id);
    if (isOpening && !loadingItensRef.current.has(orc.id)) {
      const cached = itensProducaoMap[orc.id];
      if (cached === undefined || cached.length === 0) {
        loadingItensRef.current.add(orc.id);
        const itens = await fetchItensProducao(orc.id);
        setItensProducaoMap(prev => ({ ...prev, [orc.id]: itens }));
        loadingItensRef.current.delete(orc.id);
      }
    }
  }, [expandedOrcId, itensProducaoMap]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [propRes, orcRes, finRes] = await Promise.all([
        supabase.from("proposals").select("*").order("created_at", { ascending: false }),
        supabase
          .from("orcamentos")
          .select("id, proposal_id, valor_fechado, prazo_entrega, material_entregue, created_at, numero_pc, proposals(numero, cliente, itens)")
          .eq("material_entregue", false),
        supabase
          .from("orcamento_financeiro")
          .select("id, parcela, valor, data_prevista, recebido, orcamentos(proposal_id, proposals(numero, cliente))")
          .eq("recebido", false)
          .order("data_prevista"),
      ]);

      setProposals((propRes.data || []) as ProposalRow[]);
      setOrcamentos((orcRes.data || []) as unknown as OrcamentoRow[]);
      setFinanceiro((finRes.data || []) as unknown as FinanceiroRow[]);

      // Fetch processos and arquivos for em-andamento orcamentos
      const orcIds = (orcRes.data || []).map((o: any) => o.id);
      if (orcIds.length > 0) {
        const [procsRes, arqsRes] = await Promise.all([
          supabase
            .from("orcamento_processos")
            .select("id, orcamento_id, nome, dias, ordem, concluido, concluido_em")
            .in("orcamento_id", orcIds)
            .order("ordem"),
          supabase
            .from("orcamento_arquivos")
            .select("id, orcamento_id, tipo, nome, storage_path")
            .in("orcamento_id", orcIds),
        ]);

        const procMap: Record<string, ProcessoRow[]> = {};
        (procsRes.data || []).forEach((p: any) => {
          if (!procMap[p.orcamento_id]) procMap[p.orcamento_id] = [];
          procMap[p.orcamento_id].push(p as ProcessoRow);
        });

        const arqMap: Record<string, ArquivoRow[]> = {};
        (arqsRes.data || []).forEach((a: any) => {
          if (!arqMap[a.orcamento_id]) arqMap[a.orcamento_id] = [];
          arqMap[a.orcamento_id].push({
            ...a,
            publicUrl: supabase.storage.from("orcamentos").getPublicUrl(a.storage_path).data.publicUrl,
          } as ArquivoRow);
        });

        setProcessosByOrc(procMap);
        setArquivosByOrc(arqMap);
      }

      setLoading(false);
    };
    fetchAll();
  }, []);

  const filteredProposals = useMemo(() => {
    if (monthFilter === "todos") return proposals;
    return proposals.filter(p => p.emitido_em.startsWith(monthFilter));
  }, [proposals, monthFilter]);

  const openProposals = filteredProposals.filter(p => p.status === "aberta");
  const closedProposals = filteredProposals.filter(p => p.status === "fechada");
  const openTotal = openProposals.reduce((s, p) => s + getProposalTotal(p), 0);
  const closedTotal = closedProposals.reduce((s, p) => s + Number(p.valor_fechado), 0);
  const totalAReceber = financeiro.reduce((s, f) => s + Number(f.valor), 0);

  const currentMonthLabel = monthFilter === "todos"
    ? "Todos os meses"
    : (monthOptions.find(o => o.value === monthFilter)?.label ?? "");

  const toggleKpi = (k: KpiKey) => setActiveKpi(prev => prev === k ? null : k);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const cardBase = "rounded-xl overflow-hidden";

  const kpiExpanded = activeKpi && (
    <div className={`bg-white ${cardBase}`} style={{ border: "0.5px solid #e5e5e5" }}>
      {activeKpi === "abertas" && (
        <>
          <TableHeader cols={["Proposta · Cliente", "Valor", "Data"]} />
          {openProposals.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-4">Nenhuma proposta aberta</p>
          ) : openProposals.map((p, idx) => (
            <div
              key={p.id}
              className="grid px-4 py-3 items-center hover:bg-[#fafafa]"
              style={{
                gridTemplateColumns: "1fr auto auto",
                borderTop: idx > 0 ? "0.5px solid #f0f0f0" : undefined,
              }}
            >
              <div>
                <Link to={`/app/orcamento/${p.id}`} className="text-[13px] font-semibold hover:underline">
                  #{p.numero}
                </Link>
                <span className="text-[12px] text-muted-foreground ml-2">{p.cliente?.nome || "—"}</span>
              </div>
              <span className="text-[13px] font-medium text-right mr-8">{formatCurrency(getProposalTotal(p))}</span>
              <span className="text-[12px] text-muted-foreground">{safeFormat(p.emitido_em, "dd/MM/yyyy")}</span>
            </div>
          ))}
        </>
      )}

      {activeKpi === "fechadas" && (
        <>
          <TableHeader cols={["Proposta · Cliente", "Valor fechado", "Data"]} />
          {closedProposals.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-4">Nenhuma proposta fechada</p>
          ) : closedProposals.map((p, idx) => (
            <div
              key={p.id}
              className="grid px-4 py-3 items-center hover:bg-[#fafafa]"
              style={{
                gridTemplateColumns: "1fr auto auto",
                borderTop: idx > 0 ? "0.5px solid #f0f0f0" : undefined,
              }}
            >
              <div>
                <Link to={`/app/orcamento/${p.id}`} className="text-[13px] font-semibold hover:underline">
                  #{p.numero}
                </Link>
                <span className="text-[12px] text-muted-foreground ml-2">{p.cliente?.nome || "—"}</span>
              </div>
              <span className="text-[13px] font-medium text-right mr-8" style={{ color: "#16a34a" }}>
                {formatCurrency(Number(p.valor_fechado))}
              </span>
              <span className="text-[12px] text-muted-foreground">{safeFormat(p.emitido_em, "dd/MM/yyyy")}</span>
            </div>
          ))}
        </>
      )}

      {activeKpi === "areceber" && (
        <>
          <TableHeader cols={["Proposta · Cliente", "Valor", "Vencimento", "Status"]} />
          {financeiro.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-4">Nenhuma parcela pendente</p>
          ) : financeiro.map((fin, idx) => {
            const proposalId = fin.orcamentos?.proposal_id;
            const numero = fin.orcamentos?.proposals?.numero || "—";
            const cliente = fin.orcamentos?.proposals?.cliente?.nome || "—";
            const overdue = fin.data_prevista && new Date(fin.data_prevista) < new Date();
            return (
              <div
                key={fin.id}
                className="grid px-4 py-3 items-center hover:bg-[#fafafa]"
                style={{
                  gridTemplateColumns: "1fr auto auto auto",
                  borderTop: idx > 0 ? "0.5px solid #f0f0f0" : undefined,
                  gap: "16px",
                }}
              >
                <div>
                  {proposalId ? (
                    <Link to={`/app/orcamento/${proposalId}`} className="text-[13px] font-semibold hover:underline">#{numero}</Link>
                  ) : (
                    <span className="text-[13px] font-semibold">#{numero}</span>
                  )}
                  <span className="text-[12px] text-muted-foreground ml-2">{cliente}</span>
                </div>
                <span className="text-[13px] font-medium">{formatCurrency(Number(fin.valor))}</span>
                <span className="text-[12px] text-muted-foreground">{safeFormat(fin.data_prevista, "dd/MM/yyyy")}</span>
                {overdue ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: "#fef2f2", color: "#dc2626" }}>
                    <AlertTriangle className="w-3 h-3" />Atrasado
                  </span>
                ) : (
                  <span className="inline-flex text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: "#fffbeb", color: "#d97706" }}>
                    Pendente
                  </span>
                )}
              </div>
            );
          })}
        </>
      )}

    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f9f9f8" }}>
      <AppNav />

      <main className="flex-1 container max-w-5xl mx-auto px-6 py-7 space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[20px] font-semibold leading-tight">Visão geral</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5 capitalize">{currentMonthLabel}</p>
          </div>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Filtrar por mês" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiCard
            label="Abertas" value={String(openProposals.length)}
            subtitle={formatCurrency(openTotal)}
            icon={<Clock className="w-4 h-4" style={{ color: "#16a34a" }} />}
            iconBg="#f0fdf4" borderColor="#16a34a"
            kpiKey="abertas" activeKpi={activeKpi} onToggle={toggleKpi}
          />
          <KpiCard
            label="Fechadas" value={String(closedProposals.length)}
            subtitle={formatCurrency(closedTotal)}
            icon={<CheckCircle2 className="w-4 h-4" style={{ color: "#2563eb" }} />}
            iconBg="#eff6ff" borderColor="#2563eb"
            kpiKey="fechadas" activeKpi={activeKpi} onToggle={toggleKpi}
          />
          <KpiCard
            label="A receber" value={formatCurrency(totalAReceber)}
            subtitle={`${financeiro.length} parcela${financeiro.length !== 1 ? "s" : ""} pendente${financeiro.length !== 1 ? "s" : ""}`}
            icon={<DollarSign className="w-4 h-4" style={{ color: "#d97706" }} />}
            iconBg="#fffbeb" borderColor="#d97706"
            kpiKey="areceber" activeKpi={activeKpi} onToggle={toggleKpi}
          />
        </div>

        {/* KPI expanded panel */}
        {kpiExpanded}

        {/* Em andamento */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
              Em andamento
            </span>
            {orcamentos.length > 0 && (
              <span className="text-[11px] text-muted-foreground">{orcamentos.length} orçamento{orcamentos.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {orcamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum orçamento em andamento</p>
          ) : (
            <div className="space-y-2">
              {orcamentos.map(orc => (
                <OrcamentoCard
                  key={orc.id}
                  orc={orc}
                  processos={processosByOrc[orc.id] || []}
                  arquivos={arquivosByOrc[orc.id] || []}
                  expanded={expandedOrcId === orc.id}
                  onToggle={() => handleToggleCard(orc)}
                  itensProducao={itensProducaoMap[orc.id] ?? []}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
