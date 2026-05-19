import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import logo from "@/assets/logo-frotaly.png";
import {
  AlertTriangle, Check, ChevronDown, ChevronUp,
  Clock, Download, FileText, Loader2,
} from "lucide-react";
import { format, addDays, parseISO, differenceInDays, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

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
interface PedidoItem {
  orcamentoId: string; numero: string; emitidoEm: string;
  prazoEntrega: string | null; materialEntregue: boolean;
  dataInicioProducao: string | null; numeroPC: string | null;
  finalizado: boolean; finalizadoEm: string | null;
  itens: any[]; processos: Processo[]; arquivos: Arquivo[];
}
interface ItemProducao {
  id: string; orcamento_id: string; item_index: number;
  item_nome: string; quantidade_total: number; quantidade_produzida: number;
}

async function fetchItensProducao(orcamentoId: string): Promise<ItemProducao[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("orcamento_itens_producao") as any)
    .select("id, orcamento_id, item_index, item_nome, quantidade_total, quantidade_produzida")
    .eq("orcamento_id", orcamentoId)
    .order("item_index");
  if (error) console.error('[PecasTab] Erro ao buscar itens producao:', error);
  return (data ?? []) as ItemProducao[];
}

function PecasTab({ itensProducao }: { itensProducao: ItemProducao[] }) {
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
        {itensProducao.map(ip => (
          <div key={ip.id} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: "0.5px solid #f8f8f8", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "#333", flex: 1 }}>{ip.item_nome}</span>
            <span style={{ fontSize: "11px", color: "#aaa" }}>/{ip.quantidade_total}</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#111", minWidth: "28px", textAlign: "right" }}>{ip.quantidade_produzida}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Orcamento Card ──────────────────────────────────────────────────────────
function PedidoCard({ item, expanded, onToggle, itensProducao }: {
  item: PedidoItem; expanded: boolean; onToggle: () => void; itensProducao: ItemProducao[];
}) {
  const diasRestantes = item.prazoEntrega
    ? (() => { try { return differenceInDays(parseISO(item.prazoEntrega), new Date()); } catch { return null; } })()
    : null;

  const done = item.processos.filter(p => p.concluido).length;
  const total = item.processos.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const andamentoIdx = item.processos.findIndex(p => !p.concluido);
  const dColor = daysColor(diasRestantes);
  const isAtrasado = diasRestantes !== null && diasRestantes < 0;
  const [activeTab, setActiveTab] = useState<"cronograma" | "pecas" | "documentos">("cronograma");

  const base = useMemo(() => {
    if (!item.dataInicioProducao) return null;
    try { const d = parseISO(item.dataInicioProducao); return isValid(d) ? d : null; }
    catch { return null; }
  }, [item.dataInicioProducao]);

  const startDates: (Date | null)[] = useMemo(() => {
    if (!base) return item.processos.map(() => null);
    let acc = 0; let blocked = false;
    return item.processos.map(p => {
      if (blocked) return null;
      const d = addDays(base, acc);
      if (p.dias === null) { blocked = true; } else { acc += p.dias; }
      return d;
    });
  }, [base, item.processos]);

  return (
    <div
      className="bg-white rounded-xl overflow-hidden"
      style={{ border: expanded ? "0.5px solid #bbb" : "0.5px solid #e5e5e5" }}
    >
      {/* Header */}
      <button className="w-full text-left px-5 py-4" onClick={onToggle}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {item.numeroPC ? (
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#111' }}>
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
            <span className="text-[12px] text-muted-foreground">
              Emitido em {safeFormat(item.emitidoEm, "dd/MM/yyyy")}
            </span>
            {total > 0 && (
              <div className="mt-2.5">
                <div className="w-full h-[4px] bg-[#f0f0f0] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: isAtrasado ? "#dc2626" : "#111" }}
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
              {expanded
                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
            {diasRestantes !== null && (
              <span className="text-[11px] font-medium" style={{ color: dColor }}>
                {isAtrasado ? "dias atrasado" : "dias restantes"}
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
                    const startDate = startDates[idx];
                    const endDate = startDate && p.dias != null ? addDays(startDate, p.dias) : null;
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
                          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-0.5 items-center">
                            {startDate && endDate && <span>{format(startDate, "dd/MM", { locale: ptBR })} → {format(endDate, "dd/MM", { locale: ptBR })}</span>}
                            {p.dias != null && <span className="tabular-nums">{p.dias} {p.dias === 1 ? "dia" : "dias"}</span>}
                            {p.concluido && p.concluido_em && <span style={{ color: "#16a34a" }}>Concluído em {format(parseISO(p.concluido_em), "dd/MM/yyyy", { locale: ptBR })}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Peças tab */}
          {activeTab === "pecas" && <PecasTab itensProducao={itensProducao} />}

          {/* Documentos tab */}
          {activeTab === "documentos" && (
            <div className="px-5 py-4">
              {item.arquivos.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum documento disponível</p>
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
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PedidosEmpresa() {
  const { token } = useParams<{ token: string }>();
  const { empresa } = useEmpresa();
  const [companyName, setCompanyName] = useState("");
  const [items, setItems] = useState<PedidoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [concluidosOpen, setConcluidosOpen] = useState(false);
  const [itensProducaoMap, setItensProducaoMap] = useState<Record<string, ItemProducao[]>>({});
  const loadingItensRef = useRef<Set<string>>(new Set());

  const handleToggle = useCallback(async (item: PedidoItem) => {
    const newId = expandedId === item.orcamentoId ? null : item.orcamentoId;
    setExpandedId(newId);
    if (newId && !loadingItensRef.current.has(newId)) {
      const cached = itensProducaoMap[newId];
      if (cached === undefined || cached.length === 0) {
        loadingItensRef.current.add(newId);
        const result = await fetchItensProducao(newId);
        setItensProducaoMap(prev => ({ ...prev, [newId]: result }));
        loadingItensRef.current.delete(newId);
      }
    }
  }, [expandedId, itensProducaoMap]);

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      // 1. Busca empresa pelo portal_token
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: company } = await (supabase.from("client_companies") as any)
        .select("id, nome")
        .eq("portal_token", token)
        .maybeSingle();

      if (!company) { setNotFound(true); setLoading(false); return; }
      setCompanyName(company.nome);

      // 2. Busca proposals da empresa (sem filtro de status para diagnóstico)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: proposals, error: proposalsError } = await (supabase.from("proposals") as any)
        .select("id, numero, emitido_em, itens, status")
        .eq("client_company_id", company.id);

      console.log("[PedidosEmpresa] company.id:", company.id);
      console.log("[PedidosEmpresa] proposals encontradas:", proposals, "erro:", proposalsError);

      if (!proposals?.length) { setLoading(false); return; }

      // Filtra apenas as fechadas
      const proposalsFechadas = proposals.filter((p: any) => p.status === "fechada");
      console.log("[PedidosEmpresa] proposals fechadas:", proposalsFechadas.map((p: any) => ({ id: p.id, numero: p.numero, status: p.status })));

      if (!proposalsFechadas.length) { setLoading(false); return; }

      const proposalIds = proposalsFechadas.map((p: any) => p.id);

      // 3. Busca orcamentos
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orcamentos } = await (supabase.from("orcamentos") as any)
        .select("id, proposal_id, prazo_entrega, material_entregue, data_inicio_producao, numero_pc, finalizado, finalizado_em")
        .in("proposal_id", proposalIds);

      if (!orcamentos?.length) { setLoading(false); return; }

      const orcamentoIds = orcamentos.map((o: any) => o.id);

      // 4. Busca processos e arquivos em paralelo
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

      const built: PedidoItem[] = orcamentos.map((orc: any) => {
        const proposal = proposalsFechadas.find((p: any) => p.id === orc.proposal_id);
        return {
          orcamentoId: orc.id,
          numero: proposal?.numero ?? "—",
          emitidoEm: proposal?.emitido_em ?? "",
          prazoEntrega: orc.prazo_entrega,
          materialEntregue: orc.material_entregue,
          dataInicioProducao: orc.data_inicio_producao,
          numeroPC: orc.numero_pc ?? null,
          finalizado: !!orc.finalizado,
          finalizadoEm: orc.finalizado_em ?? null,
          itens: proposal?.itens ?? [],
          processos: procMap[orc.id] || [],
          arquivos: arqMap[orc.id] || [],
        };
      });

      setItems(built);
      setLoading(false);
    };

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f9f9f8" }}>
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4" style={{ background: "#f9f9f8" }}>
        <p className="text-lg font-semibold">Link inválido ou expirado</p>
        <p className="text-sm text-muted-foreground">Este link não foi encontrado. Entre em contato com a empresa.</p>
      </div>
    );
  }

  const emProducao = items
    .filter(i => !i.materialEntregue && !i.finalizado)
    .sort((a, b) => {
      if (!a.prazoEntrega) return 1;
      if (!b.prazoEntrega) return -1;
      return new Date(a.prazoEntrega).getTime() - new Date(b.prazoEntrega).getTime();
    });

  const aguardandoEmbarque = items.filter(i => i.finalizado && !i.materialEntregue);
  const concluidos = items.filter(i => i.materialEntregue);

  const criticoCount = emProducao.filter(i => {
    if (!i.prazoEntrega) return false;
    try { const d = differenceInDays(parseISO(i.prazoEntrega), new Date()); return d <= 7; }
    catch { return false; }
  }).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f9f9f8" }}>
      {/* Nav */}
      <header className="bg-white" style={{ borderBottom: "0.5px solid #e5e5e5" }}>
        <div className="container max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <img src={logo} alt={empresa.nome} className="h-9 w-auto" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{empresa.razao_social}</p>
            <p className="text-[13px] font-semibold">Acompanhamento de pedidos</p>
          </div>
        </div>
      </header>

      <main className="flex-1 container max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Company name */}
        <div>
          <h1 className="text-[20px] font-bold">{companyName}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {items.length} pedido{items.length !== 1 ? "s" : ""} encontrado{items.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Alerta prazo crítico */}
        {criticoCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "#fef3c7", border: "0.5px solid #fcd34d" }}>
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm font-medium text-amber-800">
              Atenção: {criticoCount} pedido{criticoCount > 1 ? "s" : ""} com prazo em menos de 7 dias
            </span>
          </div>
        )}

        {/* Em produção */}
        {emProducao.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Em produção
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                {emProducao.length}
              </span>
            </div>
            {emProducao.map(item => (
              <PedidoCard
                key={item.orcamentoId}
                item={item}
                expanded={expandedId === item.orcamentoId}
                onToggle={() => handleToggle(item)}
                itensProducao={itensProducaoMap[item.orcamentoId] ?? []}
              />
            ))}
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Nenhum pedido encontrado.
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
              <div
                key={item.orcamentoId}
                className="bg-white rounded-xl px-4 py-3"
                style={{ border: "0.5px solid #e5e5e5" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.numeroPC ? (
                      <span className="font-semibold text-sm">PC · {item.numeroPC}</span>
                    ) : (
                      <span className="text-sm italic" style={{ color: "#b45309" }}>Aguardando PC</span>
                    )}
                    <span className="text-xs text-muted-foreground hidden sm:block">Orç. #{item.numero}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {item.finalizadoEm && (
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        Finalizado em {safeFormat(item.finalizadoEm, "dd/MM/yyyy")}
                      </span>
                    )}
                    <span
                      className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                      style={{ background: "#eff6ff", color: "#2563eb" }}
                    >
                      Aguardando embarque
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Concluídos */}
        {concluidos.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setConcluidosOpen(v => !v)}
              className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${concluidosOpen ? "" : "-rotate-90"}`} />
              Concluídos ({concluidos.length})
            </button>

            {concluidosOpen && (
              <div className="space-y-2">
                {concluidos.map(item => (
                  <div
                    key={item.orcamentoId}
                    className="bg-white rounded-xl px-4 py-3 flex items-center justify-between"
                    style={{ border: "0.5px solid #e5e5e5" }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-[13px]">#{item.numero}</span>
                      <span className="text-[12px] text-muted-foreground">
                        Emitido em {safeFormat(item.emitidoEm, "dd/MM/yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.prazoEntrega && (
                        <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Entrega: {safeFormat(item.prazoEntrega, "dd/MM/yyyy")}
                        </span>
                      )}
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "#f0fdf4", color: "#166534" }}
                      >
                        Entregue
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rodapé */}
        <p className="text-center text-[11px] text-muted-foreground pb-4">
          {empresa.razao_social} · CNPJ {empresa.cnpj} · {empresa.cidade} {empresa.estado}
        </p>
      </main>
    </div>
  );
}
