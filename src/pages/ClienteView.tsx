import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import logo from "@/assets/logo-3d-usinagem.png";
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp,
  Clock, Download, FileText, Loader2, PackageCheck,
} from "lucide-react";
import { format, addDays, parseISO, differenceInDays, isValid } from "date-fns";
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

interface OrcamentoPublico {
  id: string; proposal_id: string; valor_fechado: number;
  prazo_entrega: string | null; material_entregue: boolean;
  material_entregue_em: string | null; data_inicio_producao: string | null; created_at: string;
}
interface ProcessoPublico {
  id: string; nome: string; dias: number | null; ordem: number;
  concluido: boolean; concluido_em: string | null;
}
interface ProposalPublica {
  numero: string; cliente: Record<string, string>; emitido_em: string;
}
interface ArquivoPublico {
  id: string; tipo: string; nome: string; storage_path: string; publicUrl: string;
}

const ORDEM_TIPOS = ["PC", "NF"];

export default function ClienteView() {
  const { token } = useParams<{ token: string }>();
  const { empresa } = useEmpresa();
  const [orcamento, setOrcamento] = useState<OrcamentoPublico | null>(null);
  const [proposal, setProposal] = useState<ProposalPublica | null>(null);
  const [arquivos, setArquivos] = useState<ArquivoPublico[]>([]);
  const [processos, setProcessos] = useState<ProcessoPublico[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cronogramaOpen, setCronogramaOpen] = useState(true);

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      const { data: orc, error } = await supabase
        .from("orcamentos")
        .select("id, proposal_id, valor_fechado, prazo_entrega, material_entregue, material_entregue_em, data_inicio_producao, created_at")
        .eq("client_token", token)
        .maybeSingle();

      if (error || !orc) { setNotFound(true); setLoading(false); return; }
      setOrcamento(orc as unknown as OrcamentoPublico);

      const { data: prop } = await supabase
        .from("proposals").select("numero, cliente, emitido_em")
        .eq("id", orc.proposal_id).maybeSingle();
      setProposal(prop as unknown as ProposalPublica);

      const { data: arqs } = await supabase
        .from("orcamento_arquivos").select("id, tipo, nome, storage_path")
        .eq("orcamento_id", orc.id);

      setArquivos(
        (arqs || []).map(arq => ({
          ...arq,
          publicUrl: supabase.storage.from("orcamentos").getPublicUrl(arq.storage_path).data.publicUrl,
        })) as ArquivoPublico[]
      );

      const { data: procs } = await supabase
        .from("orcamento_processos")
        .select("id, nome, dias, ordem, concluido, concluido_em")
        .eq("orcamento_id", orc.id).order("ordem");
      setProcessos((procs || []) as ProcessoPublico[]);
      setLoading(false);
    };
    fetchData();
  }, [token]);

  const diasRestantes = useMemo(() => {
    if (!orcamento?.prazo_entrega) return null;
    try { return differenceInDays(parseISO(orcamento.prazo_entrega), new Date()); }
    catch { return null; }
  }, [orcamento?.prazo_entrega]);

  const dColor = daysColor(diasRestantes);

  const andamentoIdx = processos.findIndex(p => !p.concluido);
  const done = processos.filter(p => p.concluido).length;
  const pct = processos.length > 0 ? Math.round((done / processos.length) * 100) : 0;

  const base = useMemo(() => {
    if (!orcamento?.data_inicio_producao) return null;
    try { const d = parseISO(orcamento.data_inicio_producao); return isValid(d) ? d : null; }
    catch { return null; }
  }, [orcamento?.data_inicio_producao]);

  const startDates: (Date | null)[] = useMemo(() => {
    if (!base) return processos.map(() => null);
    let acc = 0; let blocked = false;
    return processos.map(p => {
      if (blocked) return null;
      const d = addDays(base, acc);
      if (p.dias === null) { blocked = true; } else { acc += p.dias; }
      return d;
    });
  }, [base, processos]);

  // Arquivos grouped
  const tiposPresentes = [
    ...ORDEM_TIPOS.filter(t => arquivos.some(a => a.tipo === t)),
    ...Array.from(new Set(arquivos.filter(a => !ORDEM_TIPOS.includes(a.tipo)).map(a => a.tipo))),
  ];
  const arquivosPorTipo = tiposPresentes.map(tipo => ({
    tipo, lista: arquivos.filter(a => a.tipo === tipo),
  }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f9f9f8" }}>
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !orcamento) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4" style={{ background: "#f9f9f8" }}>
        <p className="text-lg font-semibold">Link inválido ou expirado</p>
        <p className="text-sm text-muted-foreground">Este link de orçamento não foi encontrado. Entre em contato com a empresa.</p>
      </div>
    );
  }

  const clientName = proposal?.cliente?.nome || "—";
  const isAtrasado = diasRestantes !== null && diasRestantes < 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f9f9f8" }}>
      {/* Nav */}
      <header className="bg-white" style={{ borderBottom: "0.5px solid #e5e5e5" }}>
        <div className="container max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <img src={logo} alt={empresa.nome} className="h-9 w-auto" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{empresa.razao_social}</p>
            <p className="text-[13px] font-semibold">Acompanhamento do pedido</p>
          </div>
        </div>
      </header>

      <main className="flex-1 container max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Subtitle */}
        <div>
          <h1 className="text-[18px] font-semibold">Proposta #{proposal?.numero}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{clientName}</p>
        </div>

        {/* Hero card */}
        <div className="bg-white rounded-xl p-5" style={{ border: "0.5px solid #e5e5e5" }}>
          <div className="grid grid-cols-3 gap-5">
            {/* Valor */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Valor do pedido</p>
              <p className="text-[24px] font-bold leading-none">{formatCurrency(Number(orcamento.valor_fechado))}</p>
            </div>

            {/* Prazo */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Prazo de entrega</p>
              <p className="text-[14px] font-semibold">{safeFormat(orcamento.prazo_entrega, "dd/MM/yyyy")}</p>
              {diasRestantes !== null && (
                <div className="flex items-center gap-1 mt-0.5">
                  {isAtrasado
                    ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: dColor }} />
                    : <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: dColor }} />}
                  <span className="text-[12px] font-medium" style={{ color: dColor }}>
                    {isAtrasado
                      ? `${Math.abs(diasRestantes)} dias em atraso`
                      : `${diasRestantes} dias restantes`}
                  </span>
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Status</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    background: orcamento.material_entregue ? "#16a34a"
                      : isAtrasado ? "#dc2626"
                      : diasRestantes !== null && diasRestantes <= 7 ? "#d97706"
                      : "#2563eb"
                  }}
                />
                <span className="text-[13px] font-medium">
                  {orcamento.material_entregue ? "Concluído"
                    : isAtrasado ? "Atrasado"
                    : diasRestantes !== null && diasRestantes <= 7 ? "Prazo crítico"
                    : "Em produção"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cronograma (expansível, aberto por padrão) */}
        {processos.length > 0 && (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: "0.5px solid #e5e5e5" }}>
            <button
              className="w-full flex items-center justify-between px-5 py-4"
              onClick={() => setCronogramaOpen(v => !v)}
            >
              <div className="flex items-center gap-4">
                <span className="text-[13px] font-semibold">Cronograma de Produção</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-[3px] bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div className="h-full bg-[#111] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{done}/{processos.length} etapas</span>
                </div>
              </div>
              {cronogramaOpen
                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {cronogramaOpen && (
              <div className="px-5 pb-5" style={{ borderTop: "0.5px solid #f0f0f0" }}>
                <div className="pt-4">
                  {processos.map((p, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === processos.length - 1;
                    const isAndamento = idx === andamentoIdx;
                    const prevConcluido = idx === 0 || processos[idx - 1].concluido;
                    const startDate = startDates[idx];
                    const endDate = startDate && p.dias != null ? addDays(startDate, p.dias) : null;

                    const nodeStyle = p.concluido
                      ? { background: "#111", borderColor: "#111" }
                      : isAndamento
                      ? { background: "#2563eb", borderColor: "#2563eb" }
                      : { background: "#fff", borderColor: "#d1d5db" };

                    const lineAbove = p.concluido && prevConcluido ? "#374151" : "#e5e7eb";
                    const lineBelow = p.concluido ? "#374151" : "#e5e7eb";

                    return (
                      <div key={p.id} className="flex gap-3">
                        {/* Timeline col */}
                        <div className="flex flex-col items-center w-6 shrink-0">
                          {!isFirst && <div className="w-px h-3 shrink-0" style={{ background: lineAbove }} />}
                          <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0" style={nodeStyle}>
                            {p.concluido && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            {isAndamento && !p.concluido && <span className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          {!isLast && <div className="w-px flex-1 min-h-[28px]" style={{ background: lineBelow }} />}
                        </div>

                        {/* Content col */}
                        <div className="flex-1 pb-4 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm ${p.concluido ? "line-through text-muted-foreground" : "font-medium"}`}>
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
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5 items-center">
                            {startDate && endDate && (
                              <span>{format(startDate, "dd/MM", { locale: ptBR })} → {format(endDate, "dd/MM", { locale: ptBR })}</span>
                            )}
                            {p.dias != null && (
                              <span className="tabular-nums">{p.dias} {p.dias === 1 ? "dia" : "dias"}</span>
                            )}
                            {p.concluido && p.concluido_em && (
                              <span style={{ color: "#16a34a" }}>
                                Concluído em {format(parseISO(p.concluido_em), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Arquivos */}
        {arquivos.length > 0 ? (
          <div className="bg-white rounded-xl p-5" style={{ border: "0.5px solid #e5e5e5" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Documentos</p>
            <div className="space-y-2">
              {arquivosPorTipo.map(({ tipo, lista }) => (
                <div key={tipo}>
                  {lista.map(arq => {
                    const iconColor = TIPO_ICON_COLOR[arq.tipo] ?? "#7c3aed";
                    const tipoLabel = TIPO_LABEL[arq.tipo] ?? arq.tipo;
                    return (
                      <div
                        key={arq.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1.5"
                        style={{ background: "#f9f9f8", border: "0.5px solid #ebebeb" }}
                      >
                        <FileText className="w-4 h-4 shrink-0" style={{ color: iconColor }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium truncate">{arq.nome}</p>
                          <p className="text-[10px] text-muted-foreground">{tipoLabel}</p>
                        </div>
                        <a
                          href={arq.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5 text-blue-600" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-5" style={{ border: "0.5px solid #e5e5e5" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Documentos</p>
            <p className="text-sm text-muted-foreground italic">Nenhum documento disponível no momento</p>
          </div>
        )}

        {/* Status do pedido */}
        <div className="bg-white rounded-xl p-5" style={{ border: "0.5px solid #e5e5e5" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Status do Pedido</p>
          <div
            className="flex items-center gap-4 p-4 rounded-xl"
            style={{ border: `0.5px solid ${orcamento.material_entregue ? "#bbf7d0" : "#e5e5e5"}`, background: orcamento.material_entregue ? "#f0fdf4" : "#fafafa" }}
          >
            <PackageCheck
              className="w-5 h-5 shrink-0"
              style={{ color: orcamento.material_entregue ? "#16a34a" : "#9ca3af" }}
            />
            <div className="flex-1">
              <p className="text-[13px] font-medium">Material Entregue</p>
              {orcamento.material_entregue && orcamento.material_entregue_em && (
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Entregue em {safeFormat(orcamento.material_entregue_em, "dd/MM/yyyy")}
                </p>
              )}
            </div>
            {orcamento.material_entregue ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: "#16a34a" }}>
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span className="text-[11px] font-medium text-white">Entregue</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: "#f0f0f0" }}>
                <span className="text-[11px] font-medium text-muted-foreground">Em andamento</span>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <p className="text-center text-[11px] text-muted-foreground pb-4">
          {empresa.razao_social} · CNPJ {empresa.cnpj} · {empresa.cidade} {empresa.estado}
        </p>
      </main>
    </div>
  );
}
