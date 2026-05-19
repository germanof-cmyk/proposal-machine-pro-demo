import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { dispararAlerta } from "@/lib/alertas";
import logo from "@/assets/logo-frotaly.png";
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp,
  Download, FileText, Loader2, Printer, X,
} from "lucide-react";
import { differenceInDays, format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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

interface Processo {
  id: string; nome: string; dias: number | null; ordem: number;
  concluido: boolean; concluido_em: string | null;
}
interface Arquivo {
  id: string; tipo: string; nome: string; storage_path: string; publicUrl: string;
}
interface AlertasConfig {
  email_representante: string | null; email_cliente: string | null;
  whatsapp_representante: string | null; whatsapp_cliente: string | null;
}
interface OrcamentoItem {
  orcamentoId: string; proposalId: string; numero: string; clienteNome: string;
  emitidoEm: string; valorFechado: number; prazoEntrega: string | null;
  materialEntregue: boolean; numeroPC: string | null; clientCompanyId: string | null;
  finalizado: boolean; finalizadoEm: string | null;
  itens: any[]; processos: Processo[]; arquivos: Arquivo[];
}
interface ItemProducao {
  id: string; orcamento_id: string; item_index: number;
  item_nome: string; quantidade_total: number; quantidade_produzida: number;
}

async function fetchOrCreateItensProducao(orcamentoId: string, itens: any[], canCreate: boolean): Promise<ItemProducao[]> {
  console.log('[PecasTab] fetchOrCreateItensProducao:', { orcamentoId, canCreate, itens });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (supabase.from("orcamento_itens_producao") as any)
    .select("id, orcamento_id, item_index, item_nome, quantidade_total, quantidade_produzida")
    .eq("orcamento_id", orcamentoId)
    .order("item_index");
  if (fetchError) {
    console.error('[PecasTab] Erro ao buscar itens producao:', fetchError);
    return [];
  }
  console.log('[PecasTab] Itens producao existentes:', existing);
  if (existing && existing.length > 0) return existing as ItemProducao[];
  if (!canCreate) { console.log('[PecasTab] canCreate=false, não cria'); return []; }
  if (!itens?.length) { console.log('[PecasTab] proposals.itens vazio ou null:', itens); return []; }
  const inserts = itens.map((it: any, idx: number) => ({
    orcamento_id: orcamentoId,
    item_index: idx,
    item_nome: it.produto ?? `Item ${idx + 1}`,
    quantidade_total: Number(it.qtd) || 0,
    quantidade_produzida: 0,
  }));
  console.log('[PecasTab] Inserindo registros:', inserts);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error: insertError } = await (supabase.from("orcamento_itens_producao") as any)
    .insert(inserts)
    .select("id, orcamento_id, item_index, item_nome, quantidade_total, quantidade_produzida");
  if (insertError) {
    console.error('[PecasTab] Erro ao criar itens producao:', insertError);
    return [];
  }
  console.log('[PecasTab] Itens criados:', created);
  return (created ?? []) as ItemProducao[];
}

function PecasTab({
  itensProducao, editable, localValues, savingId, onChangeLocal, onBlur,
}: {
  itensProducao: ItemProducao[]; editable: boolean;
  localValues?: Record<string, number>; savingId?: string | null;
  onChangeLocal?: (id: string, val: number) => void;
  onBlur?: (ip: ItemProducao) => void;
}) {
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
          <span style={{ fontSize: "10px", color: "#aaa" }}>Progresso de produção</span>
          <span style={{ fontSize: "10px", fontWeight: 600, color: "#111" }}>{pct}%</span>
        </div>
        <div style={{ width: "100%", height: "5px", background: "#f0f0f0", borderRadius: "99px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#111", borderRadius: "99px", transition: "width 0.3s" }} />
        </div>
      </div>
      <div style={{ borderTop: "0.5px solid #f0f0f0", paddingTop: "8px" }}>
        {itensProducao.map(ip => {
          const displayed = editable ? (localValues?.[ip.id] ?? ip.quantidade_produzida) : ip.quantidade_produzida;
          const isSaving = savingId === ip.id;
          return (
            <div key={ip.id} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: "0.5px solid #f8f8f8", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "#333", flex: 1 }}>{ip.item_nome}</span>
              <span style={{ fontSize: "11px", color: "#aaa" }}>/{ip.quantidade_total}</span>
              {editable ? (
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <input
                    type="number" min={0} max={ip.quantidade_total}
                    value={displayed}
                    onChange={e => onChangeLocal?.(ip.id, Number(e.target.value))}
                    onBlur={() => onBlur?.(ip)}
                    onKeyDown={e => e.key === "Enter" && onBlur?.(ip)}
                    disabled={isSaving}
                    onClick={e => e.stopPropagation()}
                    style={{ width: "52px", textAlign: "center", fontSize: "12px", fontWeight: 600, border: "0.5px solid #ddd", borderRadius: "6px", padding: "3px 4px", background: isSaving ? "#f5f5f5" : "#fff", color: "#111" }}
                  />
                  {isSaving && <Loader2 style={{ width: "12px", height: "12px", color: "#aaa" }} className="animate-spin" />}
                </div>
              ) : (
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#111", minWidth: "28px", textAlign: "right" }}>{ip.quantidade_produzida}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type KpiFilter = "producao" | "critico" | "concluidos" | null;

// ─── Nav ─────────────────────────────────────────────────────────────────────
function PortalNav({ userEmail, onSignOut, nomeEmpresa }: { userEmail: string; onSignOut: () => void; nomeEmpresa: string }) {
  return (
    <nav className="h-[52px] px-6 flex items-center gap-3 shrink-0" style={{ background: "#0f0f0f" }}>
      <img src={logo} alt="Frotaly" style={{ height: 32, width: "auto" }} />
      <span className="text-white text-sm font-semibold tracking-tight">{nomeEmpresa}</span>
      <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: "#1f1f1f", color: "#a0a0a0", border: "0.5px solid #333" }}>
        Portal de Fabricação
      </span>
      <div className="flex-1" />
      <span className="text-[#a0a0a0] text-xs hidden sm:block">{userEmail}</span>
      <button
        onClick={onSignOut}
        className="text-xs px-3 py-1.5 rounded transition-colors"
        style={{ color: "#a0a0a0" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
        onMouseLeave={e => (e.currentTarget.style.color = "#a0a0a0")}
      >
        Sair
      </button>
    </nav>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, borderColor, activeFilter, filterKey, onToggle, extra,
}: {
  label: string; value: string | number; borderColor: string;
  activeFilter: KpiFilter; filterKey: KpiFilter; onToggle: (k: KpiFilter) => void;
  extra?: React.ReactNode;
}) {
  const active = activeFilter === filterKey;
  return (
    <button
      onClick={() => onToggle(filterKey)}
      className="w-full text-left bg-white rounded-xl p-4 flex flex-col gap-1 transition-colors"
      style={{ border: `0.5px solid ${active ? borderColor : "#e5e5e5"}`, borderLeft: `3px solid ${borderColor}` }}
    >
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-[28px] font-bold leading-none">{value}</p>
      {extra}
      <p className="text-[10px] font-medium mt-1" style={{ color: borderColor }}>
        {active ? "Fechar ↑" : "Ver →"}
      </p>
    </button>
  );
}

// ─── Expandable Orcamento Card ─────────────────────────────────────────────────
function OrcamentoCard({
  item, expanded, onToggle, onMarcarConcluido, markingId,
  itensProducao, onSaveProducao,
}: {
  item: OrcamentoItem; expanded: boolean; onToggle: () => void;
  onMarcarConcluido: (item: OrcamentoItem, processo: Processo) => void;
  markingId: string | null;
  itensProducao: ItemProducao[];
  onSaveProducao: (orcamentoId: string, itemId: string, quantidade: number) => Promise<void>;
}) {
  const navigate = useNavigate();
  const today = new Date();
  const [activeTab, setActiveTab] = useState<"cronograma" | "pecas" | "documentos">("cronograma");
  const [localValues, setLocalValues] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const init: Record<string, number> = {};
    itensProducao.forEach(ip => { init[ip.id] = ip.quantidade_produzida; });
    setLocalValues(init);
  }, [itensProducao]);

  const diasRestantes = item.prazoEntrega
    ? (() => { try { return differenceInDays(parseISO(item.prazoEntrega), today); } catch { return null; } })()
    : null;

  const done = item.processos.filter(p => p.concluido).length;
  const total = item.processos.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const andamentoIdx = item.processos.findIndex(p => !p.concluido);
  const dColor = daysColor(diasRestantes);

  return (
    <div
      className="bg-white rounded-xl overflow-hidden"
      style={{ border: expanded ? "0.5px solid #bbb" : "0.5px solid #e5e5e5" }}
    >
      {/* Header */}
      <button
        className="w-full text-left px-5 py-4"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {item.numeroPC ? (
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111' }}>
                  <span style={{ fontSize: '11px', fontWeight: 400, color: '#aaa' }}>PC · </span>
                  {item.numeroPC}
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>Orç. #{item.numero}</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '13px', color: '#b45309', fontStyle: 'italic' }}>Aguardando pedido de compra</div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>Orç. #{item.numero}</div>
              </div>
            )}
            <span className="text-[13px] text-muted-foreground">{formatCurrency(item.valorFechado)}</span>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Emissão: {safeFormat(item.emitidoEm, "dd/MM/yyyy")}
            </p>
            {total > 0 && (
              <div className="mt-2.5">
                <div className="w-full h-[4px] bg-[#f0f0f0] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: diasRestantes !== null && diasRestantes < 0 ? "#dc2626" : "#111" }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  {done} de {total} etapas · {pct}%
                </span>
              </div>
            )}
          </div>

          <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-2">
              {diasRestantes !== null && (
                <span className="text-[26px] font-bold leading-none" style={{ color: dColor }}>
                  {Math.abs(diasRestantes)}
                </span>
              )}
              {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
            {diasRestantes !== null && (
              <span className="text-[11px] font-medium" style={{ color: dColor }}>
                {diasRestantes < 0 ? "dias atrasado" : "dias restantes"}
              </span>
            )}
            {item.prazoEntrega && (
              <span className="text-[11px] text-muted-foreground">
                {safeFormat(item.prazoEntrega, "dd/MM/yyyy")}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded */}
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

          {/* Cronograma tab */}
          {activeTab === "cronograma" && (
            <div className="px-5 py-4">
              {item.processos.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma etapa cadastrada</p>
              ) : (
                <div>
                  {item.processos.map((p, idx) => {
                    const isAndamento = idx === andamentoIdx;
                    const isFirst = idx === 0;
                    const isLast = idx === item.processos.length - 1;
                    const prevConcluido = idx === 0 || item.processos[idx - 1].concluido;
                    const nodeStyle = p.concluido
                      ? { background: "#111", borderColor: "#111" }
                      : isAndamento ? { background: "#2563eb", borderColor: "#2563eb" }
                      : { background: "#fff", borderColor: "#d1d5db" };
                    const lineAbove = p.concluido && prevConcluido ? "#374151" : "#e5e7eb";
                    const lineBelow = p.concluido ? "#374151" : "#e5e7eb";
                    return (
                      <div key={p.id} className="flex gap-2.5">
                        <div className="flex flex-col items-center w-5 shrink-0">
                          {!isFirst && <div className="w-px h-2.5 shrink-0" style={{ background: lineAbove }} />}
                          <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0" style={nodeStyle}>
                            {p.concluido && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                            {isAndamento && !p.concluido && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          {!isLast && <div className="w-px flex-1 min-h-[20px]" style={{ background: lineBelow }} />}
                        </div>
                        <div className="flex-1 pb-3 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[12px] leading-tight ${p.concluido ? "line-through text-muted-foreground" : "font-medium"}`}>{p.nome}</span>
                            {p.concluido ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#f0fdf4", color: "#16a34a" }}>Feito</span>
                            ) : isAndamento ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#eff6ff", color: "#2563eb" }}>Andamento</span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#f5f5f5", color: "#666" }}>Pendente</span>
                            )}
                          </div>
                          {p.dias != null && <span className="text-[11px] text-muted-foreground">{p.dias} {p.dias === 1 ? "dia" : "dias"}</span>}
                          {isAndamento && !p.concluido && !item.materialEntregue && (
                            <button
                              onClick={e => { e.stopPropagation(); onMarcarConcluido(item, p); }}
                              disabled={markingId === p.id}
                              className="mt-1.5 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg text-white transition-colors"
                              style={{ background: "#111" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#333")}
                              onMouseLeave={e => (e.currentTarget.style.background = "#111")}
                            >
                              {markingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              Marcar como concluído
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Peças tab */}
          {activeTab === "pecas" && (
            <PecasTab
              itensProducao={itensProducao}
              editable={true}
              localValues={localValues}
              savingId={savingId}
              onChangeLocal={(id, val) => setLocalValues(prev => ({ ...prev, [id]: val }))}
              onBlur={async ip => {
                const val = localValues[ip.id] ?? ip.quantidade_produzida;
                setSavingId(ip.id);
                await onSaveProducao(item.orcamentoId, ip.id, val);
                setSavingId(null);
              }}
            />
          )}

          {/* Documentos tab */}
          {activeTab === "documentos" && (
            <div className="px-5 py-4">
              {item.arquivos.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum arquivo anexado ainda</p>
              ) : (
                <div className="space-y-1.5">
                  {item.arquivos.map(arq => {
                    const iconColor = TIPO_ICON_COLOR[arq.tipo] ?? "#7c3aed";
                    const tipoLabel = TIPO_LABEL[arq.tipo] ?? arq.tipo;
                    return (
                      <div key={arq.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: "#f9f9f8", border: "0.5px solid #ebebeb" }}>
                        <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium truncate">{arq.nome}</p>
                          <p className="text-[10px] text-muted-foreground">{tipoLabel}</p>
                        </div>
                        <a href={arq.publicUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1 rounded hover:bg-blue-50 transition-colors" title="Download">
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
          <div className="px-5 py-3 flex justify-end" style={{ borderTop: "0.5px solid #f0f0f0" }}>
            <button
              onClick={e => { e.stopPropagation(); navigate(`/portal/orcamento/${item.orcamentoId}`); }}
              className="text-[12px] font-medium px-4 py-2 rounded-lg text-white transition-colors"
              style={{ background: "#111" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#333")}
              onMouseLeave={e => (e.currentTarget.style.background = "#111")}
            >
              Ver detalhes completos →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Proposal row ─────────────────────────────────────────────────────────────
interface ProposalRow {
  id: string;
  numero: string;
  emitido_em: string;
  valido_ate: string;
  cliente: any;
  status: string;
  itens: Array<{ produto: string; qtd: number; valorUnit: number }>;
  desconto: number;
  frete: number;
  valor_fechado: number;
}

function getProposalTotal(p: ProposalRow): number {
  return p.itens.reduce((s, i) => s + i.qtd * i.valorUnit, 0) - Number(p.desconto) + Number(p.frete);
}

function buildMonthOptions() {
  const opts: { label: string; value: string }[] = [{ label: "Todos os meses", value: "todos" }];
  for (let i = 0; i < 13; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    opts.push({
      label: format(d, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
      value: format(d, "yyyy-MM"),
    });
  }
  return opts;
}

const MONTH_OPTIONS = buildMonthOptions();

// ─── Main ────────────────────────────────────────────────────────────────────
export default function PortalDashboard() {
  const navigate = useNavigate();
  const { empresa } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [items, setItems] = useState<OrcamentoItem[]>([]);
  const [alertasConfig, setAlertasConfig] = useState<AlertasConfig | null>(null);
  const [expandedOrcId, setExpandedOrcId] = useState<string | null>(null);
  const [activeKpi, setActiveKpi] = useState<KpiFilter>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [concluidosOpen, setConcluidosOpen] = useState(false);
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false);
  const [propostasModalOpen, setPropostasModalOpen] = useState(false);
  const [modalStatusFilter, setModalStatusFilter] = useState<"abertas" | "fechadas">("abertas");
  const [modalMesFilter, setModalMesFilter] = useState("todos");
  const [itensProducaoMap, setItensProducaoMap] = useState<Record<string, ItemProducao[]>>({});
  const loadingItensRef = useRef<Set<string>>(new Set());

  const [proposalList, setProposalList] = useState<ProposalRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) return;
      setUserEmail(session.user.email);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cu } = await (supabase.from("client_users") as any)
        .select("id, company_id, nome").eq("email", session.user.email).maybeSingle();
      if (!cu) return;
      setCompanyId(cu.company_id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: company } = await (supabase.from("client_companies") as any)
        .select("id, nome").eq("id", cu.company_id).maybeSingle();
      setCompanyName(company?.nome ?? "");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ac } = await (supabase.from("alertas_config") as any)
        .select("email_representante, email_cliente, whatsapp_representante, whatsapp_cliente")
        .eq("company_id", cu.company_id).maybeSingle();
      setAlertasConfig(ac ?? null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: proposals } = await (supabase.from("proposals") as any)
        .select("id, numero, emitido_em, cliente, client_company_id, itens")
        .eq("status", "fechada");

      if (!proposals?.length) { setLoading(false); return; }

      const proposalIds = proposals.map((p: any) => p.id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orcamentos } = await (supabase.from("orcamentos") as any)
        .select("id, proposal_id, valor_fechado, prazo_entrega, material_entregue, data_inicio_producao, numero_pc, finalizado, finalizado_em")
        .in("proposal_id", proposalIds);

      if (!orcamentos?.length) { setLoading(false); return; }

      const orcamentoIds = orcamentos.map((o: any) => o.id);

      const [procsRes, arqsRes] = await Promise.all([
        supabase
          .from("orcamento_processos")
          .select("id, orcamento_id, nome, dias, ordem, concluido, concluido_em")
          .in("orcamento_id", orcamentoIds)
          .order("ordem"),
        supabase
          .from("orcamento_arquivos")
          .select("id, orcamento_id, tipo, nome, storage_path")
          .in("orcamento_id", orcamentoIds),
      ]);

      // Build lookup maps
      const procMap: Record<string, Processo[]> = {};
      (procsRes.data || []).forEach((p: any) => {
        if (!procMap[p.orcamento_id]) procMap[p.orcamento_id] = [];
        procMap[p.orcamento_id].push(p as Processo);
      });

      const arqMap: Record<string, Arquivo[]> = {};
      (arqsRes.data || []).forEach((a: any) => {
        if (!arqMap[a.orcamento_id]) arqMap[a.orcamento_id] = [];
        arqMap[a.orcamento_id].push({
          ...a,
          publicUrl: supabase.storage.from("orcamentos").getPublicUrl(a.storage_path).data.publicUrl,
        } as Arquivo);
      });

      const built: OrcamentoItem[] = orcamentos.map((orc: any) => {
        const proposal = proposals.find((p: any) => p.id === orc.proposal_id);
        return {
          orcamentoId: orc.id,
          proposalId: orc.proposal_id,
          numero: proposal?.numero ?? "—",
          clienteNome: (proposal?.cliente as any)?.nome ?? "—",
          emitidoEm: proposal?.emitido_em ?? "",
          valorFechado: Number(orc.valor_fechado),
          prazoEntrega: orc.prazo_entrega,
          materialEntregue: orc.material_entregue,
          numeroPC: orc.numero_pc ?? null,
          clientCompanyId: proposal?.client_company_id ?? null,
          finalizado: !!orc.finalizado,
          finalizadoEm: orc.finalizado_em ?? null,
          itens: proposal?.itens ?? [],
          processos: procMap[orc.id] || [],
          arquivos: arqMap[orc.id] || [],
        };
      });

      setItems(built);

      // Also fetch proposals for the Propostas tab
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allProposals } = await (supabase.from("proposals") as any)
        .select("id, numero, emitido_em, valido_ate, cliente, status, itens, desconto, frete, valor_fechado")
        .in("status", ["aberta", "fechada"])
        .order("emitido_em", { ascending: false });
      setProposalList((allProposals ?? []) as ProposalRow[]);

      setLoading(false);
    };

    load().catch(() => {
      toast.error("Erro ao carregar dados");
      setLoading(false);
    });
  }, []);

  const handleToggleCard = useCallback(async (item: OrcamentoItem) => {
    const isOpening = expandedOrcId !== item.orcamentoId;
    const newId = isOpening ? item.orcamentoId : null;
    setExpandedOrcId(newId);
    if (newId && !loadingItensRef.current.has(newId)) {
      // Re-fetch if never fetched OR previously got empty (table may not have existed yet)
      const cached = itensProducaoMap[newId];
      if (cached === undefined || cached.length === 0) {
        loadingItensRef.current.add(newId);
        const result = await fetchOrCreateItensProducao(newId, item.itens, true);
        setItensProducaoMap(prev => ({ ...prev, [newId]: result }));
        loadingItensRef.current.delete(newId);
      }
    }
  }, [expandedOrcId, itensProducaoMap]);

  const handleSaveProducao = useCallback(async (orcamentoId: string, itemId: string, quantidade: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("orcamento_itens_producao") as any)
      .update({ quantidade_produzida: quantidade, updated_at: new Date().toISOString() })
      .eq("id", itemId);
    setItensProducaoMap(prev => ({
      ...prev,
      [orcamentoId]: (prev[orcamentoId] ?? []).map(ip =>
        ip.id === itemId ? { ...ip, quantidade_produzida: quantidade } : ip
      ),
    }));
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/portal/login", { replace: true });
  };

  const handleMarcarConcluido = useCallback(
    async (item: OrcamentoItem, processo: Processo) => {
      if (markingId) return;
      setMarkingId(processo.id);

      const concluidaEm = new Date().toISOString();
      const { data, error } = await supabase
        .from("orcamento_processos")
        .update({ concluido: true, concluido_em: concluidaEm })
        .eq("id", processo.id)
        .select()
        .single();

      if (error) {
        toast.error("Erro ao atualizar etapa");
        setMarkingId(null);
        return;
      }

      setItems(prev => prev.map(i => {
        if (i.orcamentoId !== item.orcamentoId) return i;
        return { ...i, processos: i.processos.map(p => p.id === processo.id ? (data as Processo) : p) };
      }));

      if (!item.clientCompanyId) {
        console.warn('Proposta sem empresa cliente vinculada, alerta não enviado');
      } else {
        const proximaEtapa = item.processos
          .filter(p => !p.concluido)
          .sort((a, b) => a.ordem - b.ordem)[1]?.nome || null;
        await dispararAlerta({
          tipo: "etapa_concluida",
          orcamento_id: item.orcamentoId,
          processo_id: processo.id,
          orcamento_numero: item.numero,
          empresa_nome: item.clienteNome,
          etapa_nome: processo.nome,
          company_id: item.clientCompanyId,
          proxima_etapa: proximaEtapa ?? undefined,
          numero_pc: item.numeroPC ?? undefined,
        });
      }

      toast.success(`Etapa "${processo.nome}" marcada como concluída`);
      setMarkingId(null);
    },
    [markingId, companyId]
  );

  const handleImprimir = () => {
    setPrintDropdownOpen(false);
    const el = document.getElementById("lista-impressao");
    if (!el) return;
    const janela = window.open("", "_blank");
    if (!janela) return;
    janela.document.write(`<html><head><title>Lista</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#000}table{width:100%;border-collapse:collapse}th{font-size:11px;text-transform:uppercase;padding:8px 10px;border-bottom:1px solid #000;text-align:left}td{font-size:12px;padding:8px 10px;border-bottom:0.5px solid #ddd}</style></head><body>${el.innerHTML}</body></html>`);
    janela.document.close();
    setTimeout(() => janela.print(), 400);
  };

  const handleImprimirCompleto = () => {
    setPrintDropdownOpen(false);
    const agora = new Date().toLocaleDateString('pt-BR') + ' · ' +
      new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const orcamentos = [...items]
      .filter(i => !i.materialEntregue)
      .sort((a, b) => {
        if (!a.prazoEntrega) return 1;
        if (!b.prazoEntrega) return -1;
        return new Date(a.prazoEntrega).getTime() - new Date(b.prazoEntrega).getTime();
      });

    const getDias = (item: OrcamentoItem): number => {
      if (!item.prazoEntrega) return 999;
      try { return differenceInDays(parseISO(item.prazoEntrega), new Date()); }
      catch { return 999; }
    };

    const total = orcamentos.length;
    const atrasados = orcamentos.filter(o => getDias(o) < 0).length;
    const criticos = orcamentos.filter(o => { const d = getDias(o); return d >= 0 && d <= 7; }).length;
    const noPrazo = orcamentos.filter(o => getDias(o) > 7).length;

    const conteudo = `
      <div class="print-header">
        <div class="ph-left">
          <img src="${logo}" alt="Frotaly" style="height:44px;width:auto;" />
          <div>
            <div class="ph-brand">${empresa.nome}</div>
            <div class="ph-sub">Portal de Fabricação · Lista Completa</div>
          </div>
        </div>
        <div class="ph-right">
          <div class="ph-title">Relatório de Produção</div>
          <div class="ph-date">${agora}</div>
        </div>
      </div>

      <div class="summary-bar">
        <div class="sum-item">
          <div class="sum-label">Em produção</div>
          <div class="sum-val">${total}</div>
          <div class="sum-sub">pedidos ativos</div>
        </div>
        <div class="sum-item">
          <div class="sum-label">Prazo crítico</div>
          <div class="sum-val red">${criticos}</div>
          <div class="sum-sub">menos de 7 dias</div>
        </div>
        <div class="sum-item">
          <div class="sum-label">Atrasados</div>
          <div class="sum-val red">${atrasados}</div>
          <div class="sum-sub">fora do prazo</div>
        </div>
        <div class="sum-item">
          <div class="sum-label">No prazo</div>
          <div class="sum-val green">${noPrazo}</div>
          <div class="sum-sub">dentro do prazo</div>
        </div>
      </div>

      ${orcamentos.map(orc => {
        const dias = getDias(orc);
        const status = dias < 0 ? 'Atrasado' : dias <= 7 ? 'Crítico' : 'No prazo';
        const statusColor = dias < 0 ? '#991b1b' : dias <= 7 ? '#b45309' : '#166534';
        const statusBg = dias < 0 ? '#fef2f2' : dias <= 7 ? '#fffbeb' : '#f0fdf4';
        const progPct = orc.processos.length
          ? Math.round((orc.processos.filter(p => p.concluido).length / orc.processos.length) * 100)
          : 0;
        const progColor = dias < 0 ? '#dc2626' : '#111';
        const diasLabel = dias < 0
          ? `${Math.abs(dias)} dia${Math.abs(dias) > 1 ? 's' : ''} atrasado`
          : dias === 999
          ? '— sem prazo'
          : `${dias} dia${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`;

        return `
          <div class="orc-card">
            <div class="orc-head">
              <div>
                <div class="oh-num">${orc.numero || '—'}</div>
                <div class="oh-pc">PC · ${orc.numeroPC || 'não informado'}</div>
              </div>
              <div class="oh-right">
                <div>
                  <div class="oh-prazo-label">Prazo de entrega</div>
                  <div class="oh-prazo-val">${orc.prazoEntrega ? safeFormat(orc.prazoEntrega, 'dd/MM/yyyy') : '—'}</div>
                </div>
                <span class="oh-dias" style="background:${statusBg};color:${statusColor}">
                  ${diasLabel}
                </span>
                <span class="badge-status" style="background:${statusBg};color:${statusColor}">
                  ${status}
                </span>
              </div>
            </div>

            <div class="prog-section">
              <div class="prog-row">
                <span>Progresso · ${orc.processos.filter(p => p.concluido).length} de ${orc.processos.length} etapas</span>
                <span>${progPct}%</span>
              </div>
              <div class="prog-track">
                <div class="prog-fill" style="width:${progPct}%;background:${progColor}"></div>
              </div>
            </div>

            <div class="orc-body">
              <div class="col">
                <div class="col-title">Cronograma</div>
                ${orc.processos.length
                  ? orc.processos.map((p, idx) => {
                      const isActive = !p.concluido && (idx === 0 || orc.processos[idx - 1]?.concluido);
                      const dotStyle = p.concluido ? 'done' : isActive ? 'active' : '';
                      const badge = p.concluido
                        ? '<span class="proc-badge pb-done">Feito</span>'
                        : isActive
                        ? '<span class="proc-badge pb-active">Andamento</span>'
                        : '<span class="proc-badge pb-pend">Pendente</span>';
                      const check = p.concluido
                        ? '<svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2L6.5 2" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                        : '';
                      return `
                        <div class="proc-item">
                          <div class="proc-dot ${dotStyle}">${check}</div>
                          <span class="proc-name ${p.concluido ? 'done' : ''}">${p.nome}</span>
                          <span class="proc-days">${p.dias ? p.dias + 'd' : '—'}</span>
                          ${badge}
                        </div>`;
                    }).join('')
                  : '<div class="proc-item"><span style="color:#bbb;font-size:11px">Nenhuma etapa cadastrada</span></div>'
                }
              </div>
              <div class="col">
                <div class="col-title">Documentos</div>
                ${orc.arquivos.length
                  ? orc.arquivos.map(a => {
                      const cor = a.tipo === 'PC' ? '#d97706' : a.tipo === 'NF' ? '#16a34a' : '#7c3aed';
                      return `
                        <div class="file-item">
                          <div class="file-dot" style="background:${cor}"></div>
                          <span class="file-name">${a.nome}</span>
                          <span class="file-type">${a.tipo}</span>
                        </div>`;
                    }).join('')
                  : '<div class="file-item"><span style="color:#bbb;font-size:11px">Nenhum arquivo anexado</span></div>'
                }
              </div>
            </div>

            ${(() => {
              const ips = itensProducaoMap[orc.orcamentoId] ?? [];
              if (!ips.length) return '';
              const tot = ips.reduce((s: number, ip: ItemProducao) => s + ip.quantidade_total, 0);
              const prod = ips.reduce((s: number, ip: ItemProducao) => s + ip.quantidade_produzida, 0);
              const rest = tot - prod;
              const pct2 = tot > 0 ? Math.round((prod / tot) * 100) : 0;
              return `
              <div class="pecas-section">
                <div class="col-title">Peças do pedido</div>
                <div class="pecas-kpis">
                  <div class="pk-item"><div class="pk-label">Total</div><div class="pk-val">${tot}</div></div>
                  <div class="pk-item"><div class="pk-label">Produzidas</div><div class="pk-val green">${prod}</div></div>
                  <div class="pk-item"><div class="pk-label">Restantes</div><div class="pk-val">${rest}</div></div>
                </div>
                <div class="prog-track" style="margin:6px 0 8px">
                  <div class="prog-fill" style="width:${pct2}%;background:#111"></div>
                </div>
                <table class="items-table">
                  <thead><tr><th>Peça</th><th class="qty-col">Total</th><th class="qty-col">Produzidas</th><th class="qty-col">Restantes</th></tr></thead>
                  <tbody>
                    ${ips.map((ip: ItemProducao) => `<tr>
                      <td>${ip.item_nome}</td>
                      <td class="qty-col">${ip.quantidade_total}</td>
                      <td class="qty-col">${ip.quantidade_produzida}</td>
                      <td class="qty-col">${ip.quantidade_total - ip.quantidade_produzida}</td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>`;
            })()}
          </div>`;
      }).join('')}

      <div class="print-footer">
        <span>${empresa.razao_social} · CNPJ ${empresa.cnpj} · ${empresa.cidade} ${empresa.estado}</span>
        <span>Gerado em ${agora} · Portal de Fabricação</span>
      </div>
    `;

    const estilos = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; color: #111; padding: 32px; background: #fff; }
      .print-header { display: flex; align-items: center; justify-content: space-between;
        padding-bottom: 20px; border-bottom: 2px solid #111; margin-bottom: 28px; }
      .ph-left { display: flex; align-items: center; gap: 14px; }
      .ph-logo { height: 44px; width: auto; }
      .ph-brand { font-size: 18px; font-weight: 700; }
      .ph-sub { font-size: 11px; color: #888; margin-top: 2px; }
      .ph-right { text-align: right; }
      .ph-title { font-size: 13px; font-weight: 600; }
      .ph-date { font-size: 11px; color: #888; margin-top: 2px; }
      .summary-bar { display: grid; grid-template-columns: repeat(4,1fr);
        gap: 12px; margin-bottom: 28px; }
      .sum-item { background: #f9f9f8; border-radius: 8px; padding: 12px 14px; border: 1px solid #eee; }
      .sum-label { font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
        text-transform: uppercase; color: #aaa; margin-bottom: 4px; }
      .sum-val { font-size: 18px; font-weight: 700; }
      .sum-val.red { color: #dc2626; }
      .sum-val.green { color: #16a34a; }
      .sum-sub { font-size: 10px; color: #aaa; margin-top: 2px; }
      .orc-card { border: 1px solid #e5e5e5; border-radius: 10px; overflow: hidden;
        margin-bottom: 16px; page-break-inside: avoid; }
      .orc-head { display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px; border-bottom: 1px solid #f0f0f0; background: #fafafa; }
      .oh-num { font-size: 15px; font-weight: 700; }
      .oh-pc { font-size: 11px; color: #888; margin-top: 1px; }
      .oh-right { display: flex; align-items: center; gap: 12px; }
      .oh-prazo-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #aaa; }
      .oh-prazo-val { font-size: 13px; font-weight: 600; }
      .oh-dias { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; }
      .badge-status { font-size: 9px; font-weight: 700; padding: 3px 8px; border-radius: 20px;
        letter-spacing: 0.04em; text-transform: uppercase; }
      .prog-section { padding: 10px 18px; border-bottom: 1px solid #f0f0f0; }
      .prog-row { display: flex; justify-content: space-between;
        margin-bottom: 5px; font-size: 10px; color: #aaa; }
      .prog-track { background: #f0f0f0; border-radius: 3px; height: 5px; overflow: hidden; }
      .prog-fill { height: 5px; border-radius: 3px; }
      .orc-body { display: grid; grid-template-columns: 1fr 1fr; }
      .col { padding: 14px 18px; }
      .col:first-child { border-right: 1px solid #f0f0f0; }
      .col-title { font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
        text-transform: uppercase; color: #aaa; margin-bottom: 10px; }
      .proc-item { display: flex; align-items: center; gap: 8px;
        padding: 5px 0; border-bottom: 1px solid #f8f8f8; }
      .proc-item:last-child { border-bottom: none; }
      .proc-dot { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid #ddd;
        flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
      .proc-dot.done { background: #111; border-color: #111; }
      .proc-dot.active { background: #eff6ff; border-color: #2563eb; }
      .proc-name { font-size: 11px; color: #333; flex: 1; }
      .proc-name.done { color: #aaa; text-decoration: line-through; }
      .proc-days { font-size: 10px; color: #aaa; margin-right: 4px; }
      .proc-badge { font-size: 9px; font-weight: 600; padding: 1px 6px; border-radius: 20px; }
      .pb-done { background: #f0fdf4; color: #166534; }
      .pb-active { background: #eff6ff; color: #1d4ed8; }
      .pb-pend { background: #f8f8f8; color: #aaa; }
      .file-item { display: flex; align-items: center; gap: 8px;
        padding: 5px 0; border-bottom: 1px solid #f8f8f8; }
      .file-item:last-child { border-bottom: none; }
      .file-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
      .file-name { font-size: 11px; color: #333; flex: 1; }
      .file-type { font-size: 9px; font-weight: 600; color: #aaa; }
      .pecas-section { padding: 14px 18px; border-top: 1px solid #f0f0f0; }
      .pecas-kpis { display: flex; gap: 16px; margin-bottom: 6px; }
      .pk-item { display: flex; flex-direction: column; }
      .pk-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #aaa; }
      .pk-val { font-size: 16px; font-weight: 700; }
      .pk-val.green { color: #16a34a; }
      .items-section { padding: 14px 18px; border-top: 1px solid #f0f0f0; }
      .items-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      .items-table th { font-size: 9px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.08em; color: #aaa; padding: 4px 0; border-bottom: 1px solid #eee; text-align: left; }
      .items-table td { font-size: 11px; color: #333; padding: 5px 0; border-bottom: 1px solid #f8f8f8; }
      .items-table .qty-col { text-align: right; color: #888; width: 60px; }
      .print-footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee;
        display: flex; justify-content: space-between; font-size: 10px; color: #aaa; }
      @media print {
        body { padding: 16px; }
        .orc-card { page-break-inside: avoid; }
      }
    `;

    const janela = window.open('', '_blank');
    if (!janela) return;
    janela.document.write(`
      <html>
      <head>
        <title>Relatório de Produção · ${empresa.nome}</title>
        <style>${estilos}</style>
      </head>
      <body>${conteudo}</body>
      </html>
    `);
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 800);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f9f9f8" }}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const today = new Date();
  const emProducao = items.filter(i => !i.materialEntregue && !i.finalizado);
  const aguardandoEmbarque = items.filter(i => i.finalizado && !i.materialEntregue);
  const concluidos = items.filter(i => i.materialEntregue);

  const emProducaoSorted = [...emProducao].sort((a, b) => {
    if (!a.prazoEntrega) return 1;
    if (!b.prazoEntrega) return -1;
    return new Date(a.prazoEntrega).getTime() - new Date(b.prazoEntrega).getTime();
  });

  const criticoItems = emProducao.filter(i => {
    if (!i.prazoEntrega) return false;
    try { const d = differenceInDays(parseISO(i.prazoEntrega), today); return d <= 7; }
    catch { return false; }
  });

  const alertaItems = emProducao.filter(i => {
    if (!i.prazoEntrega) return false;
    try { return differenceInDays(parseISO(i.prazoEntrega), today) <= 7; }
    catch { return false; }
  });

  const toggleKpi = (k: KpiFilter) => setActiveKpi(prev => prev === k ? null : k);

  // KPI filter list
  let kpiList: OrcamentoItem[] = [];
  if (activeKpi === "producao") kpiList = emProducaoSorted;
  else if (activeKpi === "critico") kpiList = criticoItems;
  else if (activeKpi === "concluidos") kpiList = concluidos;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f9f9f8" }}>
      <PortalNav userEmail={userEmail} onSignOut={handleSignOut} nomeEmpresa={empresa.nome} />

      <main className="flex-1 container max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">
              Bem-vindo{companyName ? `, ${companyName}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Acompanhe seus orçamentos e cronogramas de produção
            </p>
          </div>
          <div className="no-print flex items-center gap-2 shrink-0">
            <button
                onClick={() => setPropostasModalOpen(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ border: "0.5px solid var(--color-border-secondary, #e5e5e5)", background: "#fff", color: "#666" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#f5f5f5"; e.currentTarget.style.color = "#111"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#666"; }}
              >
                <FileText className="w-3.5 h-3.5" />
                Propostas em aberto
              </button>
            <div className="relative">
              <button
                onClick={() => setPrintDropdownOpen(v => !v)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ border: "0.5px solid #e5e5e5", color: "#666" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#f5f5f5"; e.currentTarget.style.color = "#111"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#666"; }}
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir lista
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>
              {printDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setPrintDropdownOpen(false)} />
                  <div
                    className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg overflow-hidden"
                    style={{ border: "0.5px solid #e5e5e5", minWidth: 160, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  >
                    <button
                      onClick={handleImprimir}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[#f5f5f5] transition-colors"
                      style={{ color: "#333" }}
                    >
                      Lista básica
                    </button>
                    <button
                      onClick={handleImprimirCompleto}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[#f5f5f5] transition-colors"
                      style={{ color: "#333", borderTop: "0.5px solid #f0f0f0" }}
                    >
                      Lista completa
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── EM PRODUÇÃO ──────────────────────────────────────────────── */}
        <>

        {/* Alerta de prazo */}
        {alertaItems.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "#fef3c7", border: "0.5px solid #fcd34d" }}>
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm font-medium text-amber-800">
              Atenção: {alertaItems.length} orçamento{alertaItems.length > 1 ? "s" : ""} com prazo crítico (menos de 7 dias)
            </span>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <KpiCard
            label="Em produção" value={emProducao.length}
            borderColor="#16a34a" activeFilter={activeKpi} filterKey="producao" onToggle={toggleKpi}
          />
          <KpiCard
            label="Prazo crítico" value={criticoItems.length}
            borderColor="#dc2626" activeFilter={activeKpi} filterKey="critico" onToggle={toggleKpi}
            extra={criticoItems.length > 0 ? <span className="text-[12px] font-medium text-red-600">≤ 7 dias</span> : undefined}
          />
          <KpiCard
            label="Concluídos" value={concluidos.length}
            borderColor="#9ca3af" activeFilter={activeKpi} filterKey="concluidos" onToggle={toggleKpi}
          />
        </div>

        {/* KPI expanded list */}
        {activeKpi && kpiList.length > 0 && (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: "0.5px solid #e5e5e5" }}>
            <div className="px-4 py-2.5 grid" style={{ gridTemplateColumns: "1fr auto auto auto", borderBottom: "0.5px solid #f0f0f0", background: "#fafafa", gap: "16px" }}>
              {["Proposta", "Valor", "Prazo", "Status"].map(c => (
                <span key={c} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{c}</span>
              ))}
            </div>
            {kpiList.map((item, idx) => {
              const dr = item.prazoEntrega
                ? (() => { try { return differenceInDays(parseISO(item.prazoEntrega), today); } catch { return null; } })()
                : null;
              const isAtrasado = dr !== null && dr < 0;
              const isCritico = dr !== null && dr >= 0 && dr <= 7;
              return (
                <div
                  key={item.orcamentoId}
                  className="px-4 py-3 grid items-center hover:bg-[#fafafa]"
                  style={{ gridTemplateColumns: "1fr auto auto auto", borderTop: idx > 0 ? "0.5px solid #f0f0f0" : undefined, gap: "16px" }}
                >
                  <div>
                    <span className="text-[13px] font-semibold">#{item.numero}</span>
                    <span className="text-[12px] text-muted-foreground ml-2">{item.clienteNome}</span>
                  </div>
                  <span className="text-[13px] font-medium">{formatCurrency(item.valorFechado)}</span>
                  <span className="text-[12px] text-muted-foreground">{safeFormat(item.prazoEntrega, "dd/MM/yyyy")}</span>
                  {isAtrasado ? (
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: "#fef2f2", color: "#dc2626" }}>Atrasado</span>
                  ) : isCritico ? (
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: "#fef2f2", color: "#dc2626" }}>Crítico</span>
                  ) : item.materialEntregue ? (
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: "#f0f0f0", color: "#666" }}>Concluído</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: "#f0fdf4", color: "#16a34a" }}>No prazo</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {activeKpi && kpiList.length === 0 && (
          <p className="text-sm text-muted-foreground py-2 text-center">Nenhum orçamento nesta categoria</p>
        )}

        {/* Em produção — expandable cards */}
        {emProducaoSorted.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Em produção
            </h2>
            {emProducaoSorted.map(item => (
              <OrcamentoCard
                key={item.orcamentoId}
                item={item}
                expanded={expandedOrcId === item.orcamentoId}
                onToggle={() => handleToggleCard(item)}
                onMarcarConcluido={handleMarcarConcluido}
                markingId={markingId}
                itensProducao={itensProducaoMap[item.orcamentoId] ?? []}
                onSaveProducao={handleSaveProducao}
              />
            ))}
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Nenhum orçamento encontrado para sua empresa.
          </div>
        )}

        {/* Aguardando embarque */}
        {aguardandoEmbarque.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Aguardando embarque
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#eff6ff", color: "#2563eb" }}>
                {aguardandoEmbarque.length}
              </span>
            </div>
            {aguardandoEmbarque.map(item => (
              <button
                key={item.orcamentoId}
                onClick={() => navigate(`/portal/orcamento/${item.orcamentoId}`)}
                className="w-full text-left bg-white rounded-xl px-4 py-3 transition-colors hover:border-[#bbb]"
                style={{ border: "0.5px solid #e5e5e5" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {item.numeroPC ? (
                      <span className="font-semibold text-sm">PC · {item.numeroPC}</span>
                    ) : (
                      <span className="text-sm italic" style={{ color: "#b45309" }}>Aguardando PC</span>
                    )}
                    <span className="text-xs text-muted-foreground">Orç. #{item.numero}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.finalizadoEm && (
                      <span className="text-xs text-muted-foreground">
                        Finalizado em {safeFormat(item.finalizadoEm, "dd/MM/yyyy")}
                      </span>
                    )}
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "#eff6ff", color: "#2563eb" }}
                    >
                      Aguardando embarque
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Concluídos (collapsible) */}
        {concluidos.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setConcluidosOpen(v => !v)}
              className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              {concluidosOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 -rotate-90" />}
              Concluídos ({concluidos.length})
            </button>
            {concluidosOpen && (
              <div className="space-y-2">
                {concluidos.map(item => (
                  <button
                    key={item.orcamentoId}
                    onClick={() => navigate(`/portal/orcamento/${item.orcamentoId}`)}
                    className="w-full text-left bg-white rounded-xl px-4 py-3 transition-colors hover:border-[#bbb]"
                    style={{ border: "0.5px solid #e5e5e5" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm">#{item.numero}</span>
                        <span className="text-xs text-muted-foreground">{safeFormat(item.emitidoEm, "dd/MM/yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{formatCurrency(item.valorFechado)}</span>
                        {item.prazoEntrega && (
                          <span className="text-xs text-muted-foreground">Entrega: {safeFormat(item.prazoEntrega, "dd/MM/yyyy")}</span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: "#f0f0f0", color: "#666" }}>Concluído</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        </>

      </main>

      {/* Hidden print content */}
      <div id="lista-impressao" style={{ display: "none" }}>
        <h1>{empresa.nome} · Portal de Fabricação{companyName ? ` · ${companyName}` : ""} · {format(new Date(), "dd/MM/yyyy")}</h1>
        {emProducaoSorted.length > 0 && (
          <>
            <p style={{ fontWeight: "bold", marginTop: "16px" }}>Em produção</p>
            <table>
              <thead><tr><th>Nº</th><th>Valor</th><th>Prazo</th><th>Status</th></tr></thead>
              <tbody>
                {emProducaoSorted.map(item => {
                  const dr = item.prazoEntrega ? (() => { try { return differenceInDays(parseISO(item.prazoEntrega), today); } catch { return null; } })() : null;
                  const isAtrasado = dr !== null && dr < 0;
                  const isCritico = dr !== null && dr >= 0 && dr <= 7;
                  return (
                    <tr key={item.orcamentoId}>
                      <td>#{item.numero}</td>
                      <td>{formatCurrency(item.valorFechado)}</td>
                      <td>{safeFormat(item.prazoEntrega, "dd/MM/yyyy")}</td>
                      <td>{isAtrasado ? "Atrasado" : isCritico ? "Crítico" : "No prazo"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
        {concluidos.length > 0 && (
          <>
            <p style={{ fontWeight: "bold", marginTop: "16px" }}>Concluídos</p>
            <table>
              <thead><tr><th>Nº</th><th>Valor</th><th>Entrega</th></tr></thead>
              <tbody>
                {concluidos.map(item => (
                  <tr key={item.orcamentoId}>
                    <td>#{item.numero}</td>
                    <td>{formatCurrency(item.valorFechado)}</td>
                    <td>{safeFormat(item.prazoEntrega, "dd/MM/yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <p style={{ marginTop: "32px", fontSize: "11px", color: "#999" }}>{empresa.razao_social}</p>
      </div>

      {/* ── MODAL PROPOSTAS ─────────────────────────────────────────── */}
      {propostasModalOpen && (() => {
        const modalFiltered = proposalList.filter(p => {
          const matchStatus = modalStatusFilter === "abertas" ? p.status === "aberta" : p.status === "fechada";
          const matchMes = modalMesFilter === "todos" || p.emitido_em.startsWith(modalMesFilter);
          return matchStatus && matchMes;
        }).sort((a, b) => b.emitido_em.localeCompare(a.emitido_em));

        const mesAbertas = proposalList.filter(p => p.status === "aberta" && (modalMesFilter === "todos" || p.emitido_em.startsWith(modalMesFilter)));
        const mesFechadas = proposalList.filter(p => p.status === "fechada" && (modalMesFilter === "todos" || p.emitido_em.startsWith(modalMesFilter)));
        const modalValorTotal = mesAbertas.reduce((s, p) => s + getProposalTotal(p), 0)
          + mesFechadas.reduce((s, p) => s + Number(p.valor_fechado), 0);
        const today2 = new Date();

        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
            onClick={() => setPropostasModalOpen(false)}
          >
            <div
              style={{ background: "#fff", borderRadius: "12px", padding: "20px", maxWidth: "700px", width: "100%", maxHeight: "85vh", overflowY: "auto", position: "relative" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Título + fechar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Propostas em aberto</h2>
                <button
                  onClick={() => setPropostasModalOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#888", display: "flex", alignItems: "center" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#111")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#888")}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                <div style={{ background: "#f9f9f8", border: "0.5px solid #e5e5e5", borderLeft: "3px solid #9ca3af", borderRadius: "10px", padding: "12px 14px" }}>
                  <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#aaa", marginBottom: "4px" }}>Abertas</p>
                  <p style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>{mesAbertas.length}</p>
                  <p style={{ fontSize: "11px", color: "#aaa", marginTop: "3px" }}>aguardando aprovação</p>
                </div>
                <div style={{ background: "#f9f9f8", border: "0.5px solid #e5e5e5", borderLeft: "3px solid #16a34a", borderRadius: "10px", padding: "12px 14px" }}>
                  <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#aaa", marginBottom: "4px" }}>Fechadas</p>
                  <p style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>{mesFechadas.length}</p>
                  <p style={{ fontSize: "11px", color: "#aaa", marginTop: "3px" }}>em produção ou concluídas</p>
                </div>
                <div style={{ background: "#f9f9f8", border: "0.5px solid #e5e5e5", borderLeft: "3px solid #2563eb", borderRadius: "10px", padding: "12px 14px" }}>
                  <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#aaa", marginBottom: "4px" }}>Valor Total</p>
                  <p style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>{formatCurrency(modalValorTotal)}</p>
                  <p style={{ fontSize: "11px", color: "#aaa", marginTop: "3px" }}>carteira completa</p>
                </div>
              </div>

              {/* Filtros */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" as const }}>
                <div style={{ display: "flex", gap: "4px" }}>
                  {(["abertas", "fechadas"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setModalStatusFilter(s)}
                      style={{
                        padding: "4px 12px", fontSize: "12px", borderRadius: "999px",
                        border: "0.5px solid #e5e5e5",
                        background: modalStatusFilter === s ? "#111" : "#fff",
                        color: modalStatusFilter === s ? "#fff" : "#333",
                        fontWeight: modalStatusFilter === s ? 600 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {s === "abertas" ? "Abertas" : "Fechadas"}
                    </button>
                  ))}
                </div>
                <select
                  value={modalMesFilter}
                  onChange={e => setModalMesFilter(e.target.value)}
                  style={{ height: "28px", fontSize: "12px", padding: "0 8px", borderRadius: "8px", border: "0.5px solid #e5e5e5", color: "#333", background: "#fff" }}
                >
                  {MONTH_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Tabela */}
              <div style={{ border: "0.5px solid #e5e5e5", borderRadius: "10px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#fafafa", borderBottom: "0.5px solid #f0f0f0" }}>
                      {["Proposta", "Cliente", "Itens", "Valor", "Emitido", "Válido até", "Status"].map(col => (
                        <th key={col} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "#888" }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modalFiltered.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "32px", textAlign: "center", fontSize: 13, color: "#aaa" }}>Nenhuma proposta encontrada</td>
                      </tr>
                    ) : modalFiltered.map((p, idx) => {
                      const isAberta = p.status === "aberta";
                      const valor = isAberta ? getProposalTotal(p) : Number(p.valor_fechado);
                      const validoAte = p.valido_ate ? (() => { try { return parseISO(p.valido_ate); } catch { return null; } })() : null;
                      const diasValidade = validoAte ? differenceInDays(validoAte, today2) : null;
                      const itensPreview = (p.itens ?? []).map((i: any) => i.produto).filter(Boolean).join(", ");

                      let validadeBg = "#f0fdf4", validadeCor = "#16a34a", validadeTexto = safeFormat(p.valido_ate, "dd/MM");
                      if (!isAberta) {
                        validadeBg = "#f5f5f5"; validadeCor = "#999"; validadeTexto = "—";
                      } else if (diasValidade !== null && diasValidade < 0) {
                        validadeBg = "#fef2f2"; validadeCor = "#dc2626";
                      } else if (diasValidade !== null && diasValidade <= 7) {
                        validadeBg = "#fffbeb"; validadeCor = "#d97706";
                      }

                      return (
                        <tr key={p.id} style={{ borderTop: idx > 0 ? "0.5px solid #f5f5f5" : undefined }}>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>#{p.numero}</div>
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: 13, color: "#333" }}>
                            {(p.cliente as any)?.nome || "—"}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ fontSize: 12, color: "#333" }}>{(p.itens ?? []).length} {(p.itens ?? []).length === 1 ? "item" : "itens"}</div>
                            {itensPreview && (
                              <div style={{ fontSize: 11, color: "#aaa", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={itensPreview}>
                                {itensPreview}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>
                            {formatCurrency(valor)}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: 12, color: "#666" }}>
                            {safeFormat(p.emitido_em, "dd/MM")}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {isAberta ? (
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: validadeBg, color: validadeCor }}>
                                {validadeTexto}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: "#bbb" }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {isAberta ? (
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#f5f5f5", color: "#555" }}>Aguardando</span>
                            ) : (
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#f0fdf4", color: "#15803d" }}>Fechada</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
