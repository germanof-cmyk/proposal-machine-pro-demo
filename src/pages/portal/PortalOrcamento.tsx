import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { CustosProducao } from "@/components/CustosProducao";
import { PortalMateriaisTab } from "@/components/PortalMateriaisTab";
import { dispararAlerta } from "@/lib/alertas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  PackageCheck,
} from "lucide-react";
import { addDays, differenceInDays, format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function safeFormat(dateStr: string | null | undefined, fmt: string): string {
  if (!dateStr) return "—";
  try {
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, fmt, { locale: ptBR }) : "—";
  } catch {
    return "—";
  }
}

interface Processo {
  id: string;
  nome: string;
  dias: number | null;
  ordem: number;
  concluido: boolean;
  concluido_em: string | null;
}

interface Arquivo {
  id: string;
  tipo: string;
  nome: string;
  storage_path: string;
  publicUrl: string;
}

interface AlertasConfig {
  email_representante: string | null;
  email_cliente: string | null;
  whatsapp_representante: string | null;
  whatsapp_cliente: string | null;
}

interface ItemProducao {
  id: string; orcamento_id: string; item_index: number;
  item_nome: string; quantidade_total: number; quantidade_produzida: number;
}

function PecasCard({
  itensProducao, onSave,
}: {
  itensProducao: ItemProducao[];
  onSave: (itemId: string, quantidade: number) => Promise<void>;
}) {
  const [localValues, setLocalValues] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const init: Record<string, number> = {};
    itensProducao.forEach(ip => { init[ip.id] = ip.quantidade_produzida; });
    setLocalValues(init);
  }, [itensProducao]);

  const totalTotal = itensProducao.reduce((s, ip) => s + ip.quantidade_total, 0);
  const totalProd = itensProducao.reduce((s, ip) => s + ip.quantidade_produzida, 0);
  const totalRest = totalTotal - totalProd;
  const pct = totalTotal > 0 ? Math.round((totalProd / totalTotal) * 100) : 0;

  if (itensProducao.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total", value: totalTotal, color: "#111" },
          { label: "Produzidas", value: totalProd, color: "#16a34a" },
          { label: "Restantes", value: totalRest, color: totalRest > 0 ? "#d97706" : "#16a34a" },
        ].map(k => (
          <div key={k.label} className="rounded-lg p-2.5" style={{ background: "#f9f9f8", border: "0.5px solid #ebebeb" }}>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{k.label}</p>
            <p className="text-xl font-bold leading-none" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="flex justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Progresso de produção</span>
          <span className="text-xs font-semibold">{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-black rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div>
        {itensProducao.map(ip => {
          const displayed = localValues[ip.id] ?? ip.quantidade_produzida;
          const isSaving = savingId === ip.id;
          return (
            <div key={ip.id} className="flex items-center py-2 border-b last:border-0 gap-3">
              <span className="text-sm flex-1">{ip.item_nome}</span>
              <span className="text-xs text-muted-foreground">/{ip.quantidade_total}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={ip.quantidade_total}
                  value={displayed}
                  onChange={e => setLocalValues(prev => ({ ...prev, [ip.id]: Number(e.target.value) }))}
                  onBlur={async () => {
                    const val = localValues[ip.id] ?? ip.quantidade_produzida;
                    setSavingId(ip.id);
                    await onSave(ip.id, val);
                    setSavingId(null);
                  }}
                  onKeyDown={async e => {
                    if (e.key === "Enter") {
                      const val = localValues[ip.id] ?? ip.quantidade_produzida;
                      setSavingId(ip.id);
                      await onSave(ip.id, val);
                      setSavingId(null);
                    }
                  }}
                  disabled={isSaving}
                  className="w-14 text-center text-sm font-semibold border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-black"
                />
                {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TIPO_LABELS: Record<string, string> = {
  PC: "Pedido de Compra (PC)",
  NF: "Nota Fiscal (NF)",
  outro: "Outros",
  outros: "Outros",
};

type TabId = "proposta" | "pecas" | "cronograma" | "custos" | "material" | "arquivos";

const TABS: { id: TabId; label: string }[] = [
  { id: "proposta", label: "Proposta" },
  { id: "pecas", label: "Peças" },
  { id: "cronograma", label: "Cronograma" },
  { id: "custos", label: "Custos realizados" },
  { id: "material", label: "Material" },
  { id: "arquivos", label: "Arquivos" },
];

const VALID_TABS: TabId[] = ["proposta", "pecas", "cronograma", "custos", "material", "arquivos"];

function getTabFromStorage(id: string | undefined): TabId {
  if (!id) return "proposta";
  try {
    const saved = localStorage.getItem(`portal_orcamento_tab_${id}`);
    if (VALID_TABS.includes(saved as TabId)) return saved as TabId;
  } catch {}
  return "proposta";
}

export default function PortalOrcamento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { empresa } = useEmpresa();

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [alertasConfig, setAlertasConfig] = useState<AlertasConfig | null>(null);

  const [orcamento, setOrcamento] = useState<any>(null);
  const [proposal, setProposal] = useState<any>(null);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [itensProducao, setItensProducao] = useState<ItemProducao[]>([]);
  const [custosResumo, setCustosResumo] = useState<{ orcado: number; realizado: number } | null>(null);

  // Finalization
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [nfInput, setNfInput] = useState("");
  const [finalizando, setFinalizando] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>(() => getTabFromStorage(id));

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    if (id) {
      try { localStorage.setItem(`portal_orcamento_tab_${id}`, tab); } catch {}
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.email) return;
      setUserEmail(session.user.email);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cu } = await (supabase.from("client_users") as any)
        .select("id, company_id")
        .eq("email", session.user.email)
        .maybeSingle();

      if (cu?.company_id) {
        setCompanyId(cu.company_id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ac } = await (supabase.from("alertas_config") as any)
          .select(
            "email_representante, email_cliente, whatsapp_representante, whatsapp_cliente"
          )
          .eq("company_id", cu.company_id)
          .maybeSingle();
        setAlertasConfig(ac ?? null);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orc, error } = await (supabase.from("orcamentos") as any)
        .select(
          "id, proposal_id, valor_fechado, prazo_entrega, material_entregue, material_entregue_em, data_inicio_producao, created_at, numero_pc, finalizado, finalizado_em, numero_nf"
        )
        .eq("id", id)
        .maybeSingle();

      if (error || !orc) {
        toast.error("Orçamento não encontrado");
        navigate("/portal");
        return;
      }
      setOrcamento(orc);

      const { data: prop, error: propError } = await supabase
        .from("proposals")
        .select("numero, cliente, emitido_em, valido_ate, client_company_id, itens, outras_observacoes")
        .eq("id", orc.proposal_id)
        .maybeSingle();
      console.log('proposal completa:', prop, 'error:', propError);
      setProposal(prop);

      const { data: procs } = await supabase
        .from("orcamento_processos")
        .select("id, nome, dias, ordem, concluido, concluido_em")
        .eq("orcamento_id", id)
        .order("ordem");
      setProcessos((procs || []) as Processo[]);

      const { data: arqs } = await supabase
        .from("orcamento_arquivos")
        .select("id, tipo, nome, storage_path")
        .eq("orcamento_id", id);

      setArquivos(
        (arqs || []).map((arq: any) => ({
          ...arq,
          publicUrl: supabase.storage
            .from("orcamentos")
            .getPublicUrl(arq.storage_path).data.publicUrl,
        }))
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ips } = await (supabase.from("orcamento_itens_producao") as any)
        .select("id, orcamento_id, item_index, item_nome, quantidade_total, quantidade_produzida")
        .eq("orcamento_id", orc.id)
        .order("item_index");

      if (ips && ips.length > 0) {
        setItensProducao(ips as ItemProducao[]);
      } else if (prop?.itens?.length) {
        const inserts = (prop.itens as any[]).map((it: any, idx: number) => ({
          orcamento_id: orc.id,
          item_index: idx,
          item_nome: it.produto ?? `Item ${idx + 1}`,
          quantidade_total: Number(it.qtd) || 0,
          quantidade_produzida: 0,
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: created } = await (supabase.from("orcamento_itens_producao") as any)
          .insert(inserts)
          .select("id, orcamento_id, item_index, item_nome, quantidade_total, quantidade_produzida");
        if (created) setItensProducao(created as ItemProducao[]);
      }

      // Fetch custos summary for meta-card
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: custosData } = await (supabase.from("orcamento_custos") as any)
        .select("item_index, valor_orcado, valor_realizado")
        .eq("orcamento_id", orc.id);

      if (custosData && prop?.itens?.length) {
        let orcado = 0;
        let realizado = 0;
        for (const c of custosData as any[]) {
          const item = (prop.itens as any[])[c.item_index];
          const qtd = Number(item?.qtd) || 1;
          orcado += Number(c.valor_orcado) * qtd;
          realizado += Number(c.valor_realizado) * qtd;
        }
        setCustosResumo({ orcado, realizado });
      }

      setLoading(false);
    };

    load().catch(() => {
      toast.error("Erro ao carregar dados");
      setLoading(false);
    });
  }, [id, navigate]);

  const handleSaveProducao = useCallback(async (itemId: string, quantidade: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("orcamento_itens_producao") as any)
      .update({ quantidade_produzida: quantidade, updated_at: new Date().toISOString() })
      .eq("id", itemId);
    setItensProducao(prev => prev.map(ip =>
      ip.id === itemId ? { ...ip, quantidade_produzida: quantidade } : ip
    ));
  }, []);

  const handleMarcarConcluido = useCallback(
    async (processo: Processo) => {
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

      setProcessos((prev) =>
        prev.map((p) => (p.id === processo.id ? (data as Processo) : p))
      );

      if (proposal && orcamento) {
        const clientCompanyId = (proposal as any).client_company_id ?? null;
        if (!clientCompanyId) {
          console.warn('Proposta sem empresa cliente vinculada, alerta não enviado');
        } else {
          const proximaEtapa = processos
            .filter(p => !p.concluido)
            .sort((a, b) => a.ordem - b.ordem)[1]?.nome || null;
          await dispararAlerta({
            tipo: "etapa_concluida",
            orcamento_id: orcamento.id,
            processo_id: processo.id,
            orcamento_numero: proposal.numero ?? "",
            empresa_nome: (proposal.cliente as any)?.nome ?? "",
            etapa_nome: processo.nome,
            company_id: clientCompanyId,
            proxima_etapa: proximaEtapa ?? undefined,
            numero_pc: orcamento.numero_pc ?? undefined,
          });
        }
      }

      toast.success(`Etapa "${processo.nome}" marcada como concluída`);
      setMarkingId(null);
    },
    [markingId, companyId, proposal, orcamento, processos]
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/portal/login", { replace: true });
  };

  const handleFinalizar = useCallback(async () => {
    if (!orcamento || !proposal) return;
    setFinalizando(true);
    const finalizadoEm = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("orcamentos") as any)
      .update({
        finalizado: true,
        finalizado_em: finalizadoEm,
        numero_nf: nfInput.trim() || null,
      })
      .eq("id", orcamento.id);

    if (error) {
      toast.error("Erro ao finalizar orçamento");
      setFinalizando(false);
      return;
    }

    setOrcamento((prev: any) => ({
      ...prev,
      finalizado: true,
      finalizado_em: finalizadoEm,
      numero_nf: nfInput.trim() || null,
    }));

    const clientCompanyId = (proposal as any).client_company_id ?? companyId;
    if (clientCompanyId) {
      await dispararAlerta({
        tipo: "orcamento_finalizado",
        orcamento_id: orcamento.id,
        orcamento_numero: proposal.numero ?? "",
        empresa_nome: (proposal.cliente as any)?.nome ?? "",
        company_id: clientCompanyId,
        numero_pc: orcamento.numero_pc ?? undefined,
        numero_nf: nfInput.trim() || undefined,
        finalizado_em: finalizadoEm,
      });
    }

    setShowFinalizarModal(false);
    setNfInput("");
    setFinalizando(false);
    toast.success("Orçamento finalizado! E-mail enviado.");
  }, [orcamento, proposal, companyId, nfInput]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f5f5" }}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orcamento) return null;

  const today = new Date();
  const diasRestantes = orcamento.prazo_entrega
    ? (() => {
        try { return differenceInDays(parseISO(orcamento.prazo_entrega), today); }
        catch { return null; }
      })()
    : null;
  const isAtrasado = diasRestantes !== null && diasRestantes < 0;
  const isCritico = diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 7;
  const isConcluido = !!orcamento.material_entregue;
  const isFinalizado = !!orcamento.finalizado;

  const andamentoIdx = processos.findIndex((p) => !p.concluido);

  const base = orcamento.data_inicio_producao
    ? (() => {
        try {
          const d = parseISO(orcamento.data_inicio_producao);
          return isValid(d) ? d : null;
        } catch { return null; }
      })()
    : null;

  const startDates: (Date | null)[] = (() => {
    if (!base) return processos.map(() => null);
    let acc = 0;
    let blocked = false;
    return processos.map((p) => {
      if (blocked) return null;
      const d = addDays(base, acc);
      if (p.dias === null) { blocked = true; } else { acc += p.dias; }
      return d;
    });
  })();

  const concluidos = processos.filter((p) => p.concluido).length;
  const progressPct = processos.length > 0 ? Math.round((concluidos / processos.length) * 100) : 0;

  const clienteName = (proposal?.cliente as any)?.nome ?? "—";

  // Prazo bar: time elapsed from start to deadline
  const prazoPct = (() => {
    if (!base || !orcamento.prazo_entrega) return null;
    try {
      const end = parseISO(orcamento.prazo_entrega);
      const total = differenceInDays(end, base);
      if (total <= 0) return 100;
      const elapsed = differenceInDays(today, base);
      return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    } catch { return null; }
  })();

  // Peças summary
  const totalPecasTotal = itensProducao.reduce((s, ip) => s + ip.quantidade_total, 0);
  const totalPecasProd = itensProducao.reduce((s, ip) => s + ip.quantidade_produzida, 0);
  const pecasPct = totalPecasTotal > 0 ? Math.round((totalPecasProd / totalPecasTotal) * 100) : 0;

  // Custos bar
  const custosPct = custosResumo && custosResumo.orcado > 0
    ? Math.min(100, Math.round((custosResumo.realizado / custosResumo.orcado) * 100))
    : 0;

  // Arquivos grouped
  const ORDEM_TIPOS = ["PC", "NF"];
  const tiposPresentes = [
    ...ORDEM_TIPOS.filter((t) => arquivos.some((a) => a.tipo === t)),
    ...Array.from(new Set(arquivos.filter((a) => !ORDEM_TIPOS.includes(a.tipo)).map((a) => a.tipo))),
  ];
  const arquivosPorTipo = tiposPresentes.map((tipo) => ({
    tipo,
    label: TIPO_LABELS[tipo] ?? tipo,
    lista: arquivos.filter((a) => a.tipo === tipo),
  }));

  // Status badge
  const statusBadge = isConcluido
    ? { label: "Concluído", bg: "#16a34a" }
    : isFinalizado
    ? { label: "Finalizado", bg: "#16a34a" }
    : isAtrasado
    ? { label: "Atrasado", bg: "#dc2626" }
    : { label: "Em produção", bg: "#2563eb" };

  // Finalizar conditions
  const allProcessosConcluidos = processos.length > 0 && processos.every(p => p.concluido);
  const allPecasProduzidas = itensProducao.length > 0 && itensProducao.every(ip => ip.quantidade_produzida >= ip.quantidade_total && ip.quantidade_total > 0);
  const canFinalizar = allProcessosConcluidos || allPecasProduzidas;
  const finalizarTooltip = !canFinalizar
    ? "Conclua todas as etapas do cronograma ou produza todas as peças para finalizar"
    : undefined;

  // Tab badge counts
  const tabBadges: Partial<Record<TabId, number>> = {
    pecas: itensProducao.length > 0 ? itensProducao.length : undefined,
    arquivos: arquivos.length > 0 ? arquivos.length : undefined,
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f5f5f5" }}>
      {/* Top nav */}
      <nav
        className="h-[52px] px-6 flex items-center gap-3 shrink-0"
        style={{ background: "#0f0f0f" }}
      >
        <div className="w-7 h-7 bg-white rounded flex items-center justify-center shrink-0">
          <span className="text-black text-[10px] font-bold tracking-tight">3D</span>
        </div>
        <button
          onClick={() => navigate("/portal")}
          className="flex items-center gap-1 text-[#a0a0a0] hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Orçamentos
        </button>
        <span className="text-[#555] text-sm">/</span>
        <span className="text-white text-sm font-medium">
          #{proposal?.numero ?? "—"} · {clienteName}
        </span>
        <div className="flex-1" />
        <span className="text-[#a0a0a0] text-xs hidden sm:block">{userEmail}</span>
        <button
          onClick={handleSignOut}
          className="text-xs px-3 py-1.5 rounded transition-colors"
          style={{ color: "#a0a0a0" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#a0a0a0")}
        >
          Sair
        </button>
      </nav>

      {/* Fixed header */}
      <div className="bg-white shrink-0" style={{ borderBottom: "0.5px solid #e5e5e5" }}>
        <div className="container max-w-3xl mx-auto px-4 pt-4 pb-3">
          {/* Back + Title + Badge */}
          <div className="flex items-start gap-3 mb-4">
            <button
              onClick={() => navigate("/portal")}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm mt-0.5 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {orcamento.numero_pc ? (
                  <h1 className="font-semibold leading-tight" style={{ fontSize: 18 }}>
                    PC · {orcamento.numero_pc}
                  </h1>
                ) : (
                  <h1 className="font-semibold leading-tight" style={{ fontSize: 18, color: "#d97706" }}>
                    Aguardando PC
                  </h1>
                )}
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                  style={{ background: statusBadge.bg }}
                >
                  {statusBadge.label}
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5" style={{ fontSize: 12 }}>
                Orç. #{proposal?.numero ?? "—"} · {clienteName}
              </p>
            </div>
          </div>

          {/* Meta-cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Prazo de entrega */}
            <div className="rounded-lg p-3" style={{ background: "#f9f9f8", border: "0.5px solid #ebebeb" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Prazo de entrega
              </p>
              <p className="text-sm font-semibold leading-tight">
                {safeFormat(orcamento.prazo_entrega, "dd/MM/yyyy")}
              </p>
              {diasRestantes !== null && (
                <p
                  className="text-[11px] mt-0.5 font-medium"
                  style={{ color: isAtrasado ? "#dc2626" : isCritico ? "#d97706" : "#6b7280" }}
                >
                  {isAtrasado
                    ? `${Math.abs(diasRestantes)}d em atraso`
                    : `${diasRestantes}d restantes`}
                </p>
              )}
              <div className="mt-2 w-full rounded-full overflow-hidden" style={{ height: 3, background: "#e5e5e5" }}>
                {prazoPct !== null && (
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${prazoPct}%`,
                      background: isAtrasado ? "#dc2626" : isCritico ? "#d97706" : "#2563eb",
                    }}
                  />
                )}
              </div>
            </div>

            {/* Cronograma */}
            <div className="rounded-lg p-3" style={{ background: "#f9f9f8", border: "0.5px solid #ebebeb" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Cronograma
              </p>
              <p className="text-sm font-semibold leading-tight">
                {concluidos} de {processos.length} etapas
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{progressPct}%</p>
              <div className="mt-2 w-full rounded-full overflow-hidden" style={{ height: 3, background: "#e5e5e5" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progressPct}%`, background: "#111" }}
                />
              </div>
            </div>

            {/* Peças produzidas */}
            <div className="rounded-lg p-3" style={{ background: "#f9f9f8", border: "0.5px solid #ebebeb" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Peças produzidas
              </p>
              <p className="text-sm font-semibold leading-tight">
                {totalPecasProd} de {totalPecasTotal}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{pecasPct}%</p>
              <div className="mt-2 w-full rounded-full overflow-hidden" style={{ height: 3, background: "#e5e5e5" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pecasPct}%`, background: "#d97706" }}
                />
              </div>
            </div>

            {/* Custos realizados */}
            <div className="rounded-lg p-3" style={{ background: "#f9f9f8", border: "0.5px solid #ebebeb" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Custos realizados
              </p>
              <p className="text-sm font-semibold leading-tight">
                {custosResumo ? formatCurrency(custosResumo.realizado) : "—"}
              </p>
              {custosResumo && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  de {formatCurrency(custosResumo.orcado)}
                </p>
              )}
              <div className="mt-2 w-full rounded-full overflow-hidden" style={{ height: 3, background: "#e5e5e5" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${custosPct}%`, background: "#7c3aed" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Finalizar row */}
        {!isConcluido && (
          <div className="container max-w-3xl mx-auto px-4 pb-3">
            {isFinalizado ? (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <PackageCheck className="w-4 h-4 shrink-0" />
                <span className="font-medium">Finalizado em {safeFormat(orcamento.finalizado_em, "dd/MM/yyyy 'às' HH:mm")}</span>
                {orcamento.numero_nf && (
                  <span className="text-xs text-muted-foreground">· NF {orcamento.numero_nf}</span>
                )}
              </div>
            ) : (
              <button
                onClick={() => canFinalizar && setShowFinalizarModal(true)}
                disabled={!canFinalizar}
                title={finalizarTooltip}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  background: canFinalizar ? "#0f0f0f" : "#f0f0f0",
                  color: canFinalizar ? "white" : "#9ca3af",
                  cursor: canFinalizar ? "pointer" : "not-allowed",
                }}
              >
                <PackageCheck className="w-3.5 h-3.5" />
                Finalizar Orçamento
              </button>
            )}
          </div>
        )}

        {/* Tab bar */}
        <div className="container max-w-3xl mx-auto px-4">
          <div
            className="flex"
            style={{ background: "var(--color-background-secondary, #f5f5f5)" }}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const badge = tabBadges[tab.id];
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className="flex items-center gap-1.5 px-4 py-2.5 transition-colors whitespace-nowrap"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    background: isActive ? "white" : "transparent",
                    borderBottom: isActive ? "2px solid #111" : "2px solid transparent",
                    color: isActive ? "#111" : "#6b7280",
                  }}
                >
                  {tab.label}
                  {badge !== undefined && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                      style={{
                        background: isActive ? "#111" : "#e5e5e5",
                        color: isActive ? "white" : "#6b7280",
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <main className="flex-1 container max-w-3xl mx-auto px-4 py-5 space-y-5">

        {/* ABA 0 — Proposta */}
        {activeTab === "proposta" && !proposal && (
          <div className="bg-white rounded-xl p-8 text-center" style={{ border: "0.5px solid #e5e5e5" }}>
            <p className="text-sm text-muted-foreground">Proposta não encontrada</p>
          </div>
        )}
        {activeTab === "proposta" && proposal && (() => {
          const cliente = (proposal.cliente as any) ?? {};
          const itens: Array<{ produto: string; qtd: number; valorUnit: number }> =
            (proposal.itens as any[]) ?? [];
          const totalItens = itens.reduce((s, it) => s + Number(it.qtd) * Number(it.valorUnit), 0);
          const valorTotal = totalItens;
          const observacoes = (proposal.outras_observacoes as string | null | undefined) || null;

          const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                {label}
              </p>
              <p className="text-sm text-foreground">{value || "—"}</p>
            </div>
          );

          return (
            <div className="space-y-4">
              {/* 2-column grid */}
              <div
                className="bg-white rounded-xl p-5 grid gap-x-8 gap-y-4"
                style={{ border: "0.5px solid #e5e5e5", gridTemplateColumns: "1fr 1fr" }}
              >
                {/* Coluna esquerda — Orçamento */}
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b pb-1.5">
                    Orçamento
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Emissão" value={safeFormat(proposal.emitido_em, "dd/MM/yyyy")} />
                    <Field label="Validade" value={safeFormat(proposal.valido_ate, "dd/MM/yyyy")} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Valor proposta" value={formatCurrency(valorTotal)} />
                    <Field label="Valor fechado" value={formatCurrency(Number(orcamento.valor_fechado))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Prazo de entrega"
                      value={
                        orcamento.prazo_entrega ? (
                          <span>
                            {safeFormat(orcamento.prazo_entrega, "dd/MM/yyyy")}
                            {diasRestantes !== null && (
                              <span
                                className="ml-1.5 text-xs"
                                style={{ color: isAtrasado ? "#dc2626" : isCritico ? "#d97706" : "#6b7280" }}
                              >
                                ({isAtrasado ? `${Math.abs(diasRestantes)}d atraso` : `${diasRestantes}d`})
                              </span>
                            )}
                          </span>
                        ) : null
                      }
                    />
                    <Field
                      label="Pedido de compra"
                      value={
                        orcamento.numero_pc
                          ? <span className="font-medium">{orcamento.numero_pc}</span>
                          : <span className="italic text-amber-600 text-xs">Aguardando PC</span>
                      }
                    />
                  </div>
                </div>

                {/* Coluna direita — Cliente */}
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b pb-1.5">
                    Cliente
                  </p>
                  <Field label="Nome" value={cliente.nome} />
                  <Field label="E-mail" value={cliente.email} />
                  <Field label="CPF / CNPJ" value={cliente.cpf_cnpj ?? cliente.cnpj ?? cliente.cpf} />
                  <Field
                    label="Endereço"
                    value={
                      [cliente.endereco, cliente.cidade && cliente.estado
                        ? `${cliente.cidade} / ${cliente.estado}`
                        : cliente.cidade || cliente.estado]
                        .filter(Boolean).join(" · ") || null
                    }
                  />
                </div>
              </div>

              {/* Itens */}
              {itens.length > 0 && (
                <div className="bg-white rounded-xl overflow-hidden" style={{ border: "0.5px solid #e5e5e5" }}>
                  <div className="px-5 py-3 border-b" style={{ borderColor: "#f0f0f0" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Itens do pedido
                    </p>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: "#fafafa", borderBottom: "0.5px solid #f0f0f0" }}>
                        <th className="text-left px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Produto / Serviço
                        </th>
                        <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-16">
                          Qtd
                        </th>
                        <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-28">
                          Vlr Unit.
                        </th>
                        <th className="text-right px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-28">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it, idx) => {
                        const total = Number(it.qtd) * Number(it.valorUnit);
                        return (
                          <tr key={idx} style={{ borderBottom: "0.5px solid #f9f9f9" }}>
                            <td className="px-5 py-2.5 text-sm">{it.produto || `Item ${idx + 1}`}</td>
                            <td className="px-4 py-2.5 text-sm text-right text-muted-foreground">{it.qtd}</td>
                            <td className="px-4 py-2.5 text-sm text-right text-muted-foreground">
                              {formatCurrency(Number(it.valorUnit))}
                            </td>
                            <td className="px-5 py-2.5 text-sm text-right font-medium">
                              {formatCurrency(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "0.5px solid #e5e5e5", background: "#fafafa" }}>
                        <td colSpan={3} className="px-5 py-2.5 text-sm font-semibold text-right text-muted-foreground">
                          Total
                        </td>
                        <td className="px-5 py-2.5 text-sm font-bold text-right">
                          {formatCurrency(totalItens)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Observações */}
              {observacoes && (
                <div className="bg-white rounded-xl p-5" style={{ border: "0.5px solid #e5e5e5" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Observações
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {observacoes}
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ABA 1 — Peças */}
        {activeTab === "pecas" && (
          <>
            {itensProducao.length > 0 ? (
              <div
                className="bg-white rounded-xl p-5"
                style={{ border: "0.5px solid #e5e5e5" }}
              >
                <PecasCard itensProducao={itensProducao} onSave={handleSaveProducao} />
              </div>
            ) : (
              <div
                className="bg-white rounded-xl p-8 text-center"
                style={{ border: "0.5px solid #e5e5e5" }}
              >
                <p className="text-sm text-muted-foreground">Nenhuma peça cadastrada</p>
              </div>
            )}
          </>
        )}

        {/* ABA 2 — Cronograma */}
        {activeTab === "cronograma" && (
          <>
            {processos.length > 0 ? (
              <div
                className="bg-white rounded-xl p-5"
                style={{ border: "0.5px solid #e5e5e5" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-muted-foreground">
                    {concluidos} de {processos.length} etapas concluídas
                  </span>
                  <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progressPct}%`, background: "#0f0f0f" }}
                    />
                  </div>
                  <span className="text-xs font-semibold">{progressPct}%</span>
                </div>
                <div className="pt-1">
                  {processos.map((p, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === processos.length - 1;
                    const isAndamento = idx === andamentoIdx;
                    const prevConcluido = idx === 0 || processos[idx - 1].concluido;
                    const startDate = startDates[idx];
                    const endDate = startDate && p.dias != null ? addDays(startDate, p.dias) : null;

                    const nodeClass = p.concluido
                      ? "bg-black border-black"
                      : isAndamento
                      ? "bg-blue-500 border-blue-500"
                      : "bg-white border-gray-300";

                    const lineAboveClass = p.concluido && prevConcluido ? "bg-gray-900" : "bg-gray-200";
                    const lineBelowClass = p.concluido ? "bg-gray-900" : "bg-gray-200";

                    return (
                      <div key={p.id} className="flex gap-3">
                        <div className="flex flex-col items-center w-6 shrink-0">
                          {!isFirst && <div className={`w-px h-3 shrink-0 ${lineAboveClass}`} />}
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${nodeClass}`}>
                            {p.concluido && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            {isAndamento && !p.concluido && <span className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          {!isLast && <div className={`w-px flex-1 min-h-[28px] ${lineBelowClass}`} />}
                        </div>
                        <div className="flex-1 pb-4 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm ${p.concluido ? "line-through text-muted-foreground" : "font-medium"}`}>
                              {p.nome}
                            </span>
                            {p.concluido ? (
                              <Badge className="bg-green-600 text-[10px] px-1.5 py-0 h-4">Feito</Badge>
                            ) : isAndamento ? (
                              <Badge className="bg-blue-600 text-[10px] px-1.5 py-0 h-4">Andamento</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Pendente</Badge>
                            )}
                            {isAndamento && !p.concluido && !orcamento.material_entregue && (
                              <Button
                                size="sm"
                                className="ml-auto h-6 text-[11px] bg-[#0f0f0f] hover:bg-[#333] text-white border-0"
                                onClick={() => handleMarcarConcluido(p)}
                                disabled={markingId === p.id}
                              >
                                {markingId === p.id ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                )}
                                Marcar como concluído
                              </Button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5 items-center">
                            {startDate && endDate && (
                              <span>
                                {format(startDate, "dd/MM", { locale: ptBR })} →{" "}
                                {format(endDate, "dd/MM", { locale: ptBR })}
                              </span>
                            )}
                            {p.dias != null && (
                              <span className="tabular-nums">
                                {p.dias} {p.dias === 1 ? "dia" : "dias"}
                              </span>
                            )}
                            {p.concluido && p.concluido_em && (
                              <span className="text-green-600">
                                Concluído em{" "}
                                {format(parseISO(p.concluido_em), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div
                className="bg-white rounded-xl p-8 text-center"
                style={{ border: "0.5px solid #e5e5e5" }}
              >
                <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada</p>
              </div>
            )}
          </>
        )}

        {/* ABA 3 — Custos realizados */}
        {activeTab === "custos" && orcamento && proposal && (
          <CustosProducao
            orcamentoId={orcamento.id}
            proposalItens={
              ((proposal as any).itens as Array<{ produto: string; qtd: number; valorUnit: number }>) ?? []
            }
            canEditOrcado={false}
            canEditParams={false}
          />
        )}

        {/* ABA 4 — Material */}
        {activeTab === "material" && orcamento && proposal && (
          <PortalMateriaisTab
            orcamentoId={orcamento.id}
            numeroPc={orcamento.numero_pc}
            proposalItens={
              ((proposal as any).itens as Array<{ produto: string; qtd: number }>) ?? []
            }
            empresa={empresa}
          />
        )}

        {/* ABA 5 — Arquivos */}
        {activeTab === "arquivos" && (
          <>
            {arquivos.length > 0 ? (
              <div
                className="bg-white rounded-xl p-5 space-y-4"
                style={{ border: "0.5px solid #e5e5e5" }}
              >
                {arquivosPorTipo.map(({ tipo, label, lista }) => (
                  <div key={tipo}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {label}
                    </p>
                    <ul className="space-y-1.5">
                      {lista.map((arq) => (
                        <li
                          key={arq.id}
                          className="flex items-center gap-3 bg-muted rounded-md px-3 py-2"
                        >
                          <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                          <a
                            href={arq.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline truncate"
                          >
                            {arq.nome}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="bg-white rounded-xl p-8 text-center"
                style={{ border: "0.5px solid #e5e5e5" }}
              >
                <p className="text-sm text-muted-foreground">Nenhum arquivo anexado</p>
              </div>
            )}
          </>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">
          {empresa.razao_social} · CNPJ {empresa.cnpj} · {empresa.cidade} {empresa.estado}
        </p>
      </main>

      {/* Finalizar modal */}
      {showFinalizarModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={e => { if (e.target === e.currentTarget && !finalizando) setShowFinalizarModal(false); }}
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-base font-semibold">
              Finalizar orçamento #{proposal?.numero}?
            </h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Isso indica que a produção foi concluída e o pedido está aguardando embarque.
              Um e-mail será enviado automaticamente.
            </p>
            <div className="mt-4">
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Número da NF
              </label>
              <input
                type="text"
                placeholder="Ex: 000003470 (opcional)"
                value={nfInput}
                onChange={e => setNfInput(e.target.value)}
                disabled={finalizando}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                onKeyDown={e => e.key === "Enter" && !finalizando && handleFinalizar()}
              />
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowFinalizarModal(false); setNfInput(""); }}
                disabled={finalizando}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleFinalizar}
                disabled={finalizando}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white transition-colors"
                style={{ background: finalizando ? "#555" : "#0f0f0f" }}
              >
                {finalizando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Finalizar e enviar e-mail →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
