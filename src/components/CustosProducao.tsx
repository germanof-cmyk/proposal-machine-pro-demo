import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, PlusCircle, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrcamentoCusto {
  id: string;
  orcamento_id: string;
  item_index: number;
  item_nome: string;
  processo_nome: string;
  valor_orcado: number;
  valor_realizado: number;
  ordem: number;
}

interface ParamsFinanceiros {
  imposto_pct: number;
  comissao_pct: number;
  transporte_pct: number;
  lucro_pct: number;
}

export interface ProposalItem {
  produto: string;
  qtd: number;
  valorUnit: number;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtPct = (v: number | null) =>
  v === null ? "—" : `${v.toFixed(1)}%`;

// ─── ItemTab ──────────────────────────────────────────────────────────────────

interface ItemCalc {
  custoOrc: number;
  custoReal: number;
  valorVenda: number;
  totalDescontos: number;
  lucroOrcado: number;
  lucroReal: number | null;
  markupReal: number | null;
}

function ItemTab({
  custos,
  calc,
  canEditOrcado,
  onUpdateCusto,
  onDeleteCusto,
  onAddProcesso,
  onGerarPadrao,
  isGerandoPadrao,
}: {
  custos: OrcamentoCusto[];
  calc: ItemCalc;
  canEditOrcado: boolean;
  onUpdateCusto: (id: string, field: "valor_orcado" | "valor_realizado", value: number) => void;
  onDeleteCusto: (id: string) => void;
  onAddProcesso: (nome: string) => void;
  onGerarPadrao: () => void;
  isGerandoPadrao?: boolean;
}) {
  const [addingRow, setAddingRow] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  const { custoOrc, custoReal, valorVenda, lucroOrcado, lucroReal, markupReal } = calc;
  const pctReal = custoOrc > 0 ? Math.min(100, (custoReal / custoOrc) * 100) : 0;

  const confirmAdd = () => {
    if (!novoNome.trim()) return;
    onAddProcesso(novoNome.trim());
    setNovoNome("");
    setAddingRow(false);
  };

  const colSpan = canEditOrcado ? 5 : 4;

  return (
    <div className="pt-4 space-y-4">
      {/* KPIs — 4 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-3 rounded-lg bg-muted">
          <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Valor de venda</p>
          <p className="text-base font-bold text-blue-600">{fmt(valorVenda)}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted">
          <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Custo orçado</p>
          <p className="text-base font-bold">{fmt(custoOrc)}</p>
          {custoOrc > 0 && (
            <div className="mt-1.5">
              <div className="w-full h-1 bg-background rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${pctReal}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{Math.round(pctReal)}% realizado</p>
            </div>
          )}
        </div>
        <div className="p-3 rounded-lg bg-muted">
          <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Lucro real</p>
          {lucroReal === null ? (
            <p className="text-xs text-amber-600 font-medium mt-1">Aguardando realizado</p>
          ) : (
            <p className={`text-base font-bold ${lucroReal >= 0 ? "text-green-600" : "text-red-600"}`}>
              {fmt(lucroReal)}
            </p>
          )}
        </div>
        <div className="p-3 rounded-lg bg-muted">
          <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Markup real</p>
          {markupReal === null ? (
            <p className="text-base font-bold text-muted-foreground">—</p>
          ) : (
            <p className="text-base font-bold">{fmtPct(markupReal)}</p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Processo</TableHead>
              <TableHead className="w-32 text-right">Orçado/un. (R$)</TableHead>
              <TableHead className="w-32 text-right">Realizado/un. (R$)</TableHead>
              <TableHead className="w-28 text-right">Diferença</TableHead>
              {canEditOrcado && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {custos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-xs text-muted-foreground py-6">
                  Nenhum processo cadastrado
                </TableCell>
              </TableRow>
            ) : (
              custos.map((c) => {
                const diff = Number(c.valor_realizado) - Number(c.valor_orcado);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{c.processo_nome}</TableCell>
                    <TableCell className="text-right">
                      {canEditOrcado ? (
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={c.valor_orcado}
                          onBlur={(e) => onUpdateCusto(c.id, "valor_orcado", Number(e.target.value))}
                          className="h-7 w-24 text-sm text-right ml-auto"
                        />
                      ) : (
                        <span className="text-sm">{fmt(Number(c.valor_orcado))}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={c.valor_realizado}
                        onBlur={(e) => onUpdateCusto(c.id, "valor_realizado", Number(e.target.value))}
                        className="h-7 w-24 text-sm text-right ml-auto"
                      />
                    </TableCell>
                    <TableCell
                      className={`text-right text-sm font-medium ${
                        diff > 0 ? "text-red-600" : diff < 0 ? "text-green-600" : "text-muted-foreground"
                      }`}
                    >
                      {diff !== 0 ? (diff > 0 ? "+" : "") + fmt(diff) : "—"}
                    </TableCell>
                    {canEditOrcado && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => onDeleteCusto(c.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add processo */}
      {canEditOrcado && (
        <div>
          {addingRow ? (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nome do processo"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmAdd();
                  if (e.key === "Escape") { setAddingRow(false); setNovoNome(""); }
                }}
                className="h-7 text-sm flex-1"
                autoFocus
              />
              <Button size="sm" className="h-7 text-xs" onClick={confirmAdd} disabled={!novoNome.trim()}>
                Confirmar
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs"
                onClick={() => { setAddingRow(false); setNovoNome(""); }}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAddingRow(true)}>
                <PlusCircle className="w-3.5 h-3.5 mr-1" />
                Adicionar processo
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                style={{ border: "0.5px solid #e5e5e5" }}
                onClick={onGerarPadrao}
                disabled={isGerandoPadrao}
              >
                {isGerandoPadrao
                  ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  : <Zap className="w-3.5 h-3.5 mr-1" />
                }
                Gerar padrão
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ResumoTab ────────────────────────────────────────────────────────────────

function ResumoTab({
  proposalItens,
  calcItem,
  params,
}: {
  proposalItens: ProposalItem[];
  calcItem: (idx: number) => ItemCalc;
  params: ParamsFinanceiros;
}) {
  const rows = proposalItens.map((item, idx) => ({
    idx,
    nome: item.produto || `Peça ${idx + 1}`,
    ...calcItem(idx),
  }));

  const totalCustoOrc = rows.reduce((s, r) => s + r.custoOrc, 0);
  const totalCustoReal = rows.every((r) => r.custoReal > 0)
    ? rows.reduce((s, r) => s + r.custoReal, 0)
    : null;
  const totalLucroReal = rows.every((r) => r.lucroReal !== null)
    ? rows.reduce((s, r) => s + (r.lucroReal ?? 0), 0)
    : null;

  return (
    <div className="pt-4 space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Peça</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Custo orçado</TableHead>
              <TableHead className="text-right">Custo realizado</TableHead>
              <TableHead className="text-right">Lucro real</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const item = proposalItens[r.idx];
              return (
                <TableRow key={r.idx}>
                  <TableCell className="text-sm">{r.nome}</TableCell>
                  <TableCell className="text-right text-sm">{item?.qtd ?? 1}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(r.custoOrc)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {r.custoReal > 0 ? fmt(r.custoReal) : "—"}
                  </TableCell>
                  <TableCell className={`text-right text-sm font-medium ${r.lucroReal === null ? "text-amber-600" : r.lucroReal >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {r.lucroReal === null ? "Aguardando" : fmt(r.lucroReal)}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell>Total</TableCell>
              <TableCell />
              <TableCell className="text-right">{fmt(totalCustoOrc)}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {totalCustoReal === null ? "—" : fmt(totalCustoReal)}
              </TableCell>
              <TableCell className={`text-right ${totalLucroReal === null ? "text-muted-foreground" : totalLucroReal >= 0 ? "text-green-600" : "text-red-600"}`}>
                {totalLucroReal === null ? "—" : fmt(totalLucroReal)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* 3 summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Custo orçado total", value: totalCustoOrc, color: "" },
          { label: "Custo realizado total", value: totalCustoReal, color: "text-amber-600" },
          {
            label: "Lucro real total",
            value: totalLucroReal,
            color: totalLucroReal === null ? "text-muted-foreground" : totalLucroReal >= 0 ? "text-green-600" : "text-red-600",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-3 rounded-lg bg-muted text-center">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>
              {value === null ? "—" : fmt(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Params display */}
      <p className="text-[11px] text-muted-foreground text-center">
        Parâmetros: Imposto {params.imposto_pct}% · Comissão {params.comissao_pct}% · Transporte {params.transporte_pct}%
      </p>
    </div>
  );
}

// ─── CustosProducao ───────────────────────────────────────────────────────────

export interface CustosProducaoProps {
  orcamentoId: string;
  proposalItens: ProposalItem[];
  /** true = representante (edita orçado + realizado + params). false = fabricante (só realizado). */
  canEditOrcado?: boolean;
  canEditParams?: boolean;
}

export function CustosProducao({
  orcamentoId,
  proposalItens,
  canEditOrcado = true,
  canEditParams = true,
}: CustosProducaoProps) {
  const [custos, setCustos] = useState<OrcamentoCusto[]>([]);
  const [params, setParams] = useState<ParamsFinanceiros>({
    imposto_pct: 12,
    comissao_pct: 7,
    transporte_pct: 5,
    lucro_pct: 20,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<number | "resumo">(0);
  const [initializedTabs, setInitializedTabs] = useState<Set<number>>(new Set());
  const [gerandoIdx, setGerandoIdx] = useState<number | null>(null);
  const [gerandoTodas, setGerandoTodas] = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const custosPromise = (supabase.from("orcamento_custos") as any)
        .select("*")
        .eq("orcamento_id", orcamentoId)
        .order("ordem");

      const paramsPromise = (supabase.from("orcamento_params_financeiros") as any)
        .select("*")
        .eq("orcamento_id", orcamentoId)
        .maybeSingle();

      const processosPromise = canEditOrcado
        ? (supabase.from("processo_custo_padrao") as any).select("nome").order("ordem")
        : Promise.resolve({ data: [] });

      const [custosRes, paramsRes, processosRes] = await Promise.all([
        custosPromise,
        paramsPromise,
        processosPromise,
      ]);

      if (cancelled) return;

      let loadedCustos = (custosRes.data ?? []) as OrcamentoCusto[];
      const processosNomes: string[] = ((processosRes.data ?? []) as any[]).map((p: any) => p.nome);

      // Auto-init tab 0 if representante and no custos exist yet
      if (
        canEditOrcado &&
        processosNomes.length > 0 &&
        proposalItens.length > 0 &&
        loadedCustos.filter((c) => c.item_index === 0).length === 0
      ) {
        const item0 = proposalItens[0];
        const rows = processosNomes.map((nome, i) => ({
          orcamento_id: orcamentoId,
          item_index: 0,
          item_nome: item0?.produto || "Peça 1",
          processo_nome: nome,
          valor_orcado: 0,
          valor_realizado: 0,
          ordem: i,
        }));
        const { data: created } = await (supabase.from("orcamento_custos") as any)
          .insert(rows)
          .select();
        if (!cancelled && created) {
          loadedCustos = [...loadedCustos, ...(created as OrcamentoCusto[])];
        }
      }

      if (cancelled) return;

      setCustos(loadedCustos);
      if (paramsRes.data) {
        setParams({
          imposto_pct: Number(paramsRes.data.imposto_pct),
          comissao_pct: Number(paramsRes.data.comissao_pct),
          transporte_pct: Number(paramsRes.data.transporte_pct ?? 5),
          lucro_pct: Number(paramsRes.data.lucro_pct),
        });
      }
      setInitializedTabs(new Set([0]));
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentoId, canEditOrcado]);

  // ── Tab click with lazy init ──────────────────────────────────────────────
  const handleTabClick = useCallback(
    async (tab: number | "resumo") => {
      setActiveTab(tab);
      if (typeof tab !== "number" || !canEditOrcado || initializedTabs.has(tab)) return;

      setInitializedTabs((prev) => new Set([...prev, tab]));
      const existing = custos.filter((c) => c.item_index === tab);
      if (existing.length > 0) return;

      const { data: pData } = await (supabase.from("processo_custo_padrao") as any)
        .select("nome")
        .order("ordem");
      const nomes: string[] = ((pData ?? []) as any[]).map((p: any) => p.nome);
      if (nomes.length === 0) return;

      const item = proposalItens[tab];
      const rows = nomes.map((nome, i) => ({
        orcamento_id: orcamentoId,
        item_index: tab,
        item_nome: item?.produto || `Peça ${tab + 1}`,
        processo_nome: nome,
        valor_orcado: 0,
        valor_realizado: 0,
        ordem: i,
      }));

      const { data: created } = await (supabase.from("orcamento_custos") as any)
        .insert(rows)
        .select();
      if (created) {
        setCustos((prev) => [...prev, ...(created as OrcamentoCusto[])]);
      }
    },
    [canEditOrcado, custos, initializedTabs, orcamentoId, proposalItens]
  );

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const updateCusto = useCallback(
    async (id: string, field: "valor_orcado" | "valor_realizado", value: number) => {
      setCustos((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
      await (supabase.from("orcamento_custos") as any).update({ [field]: value }).eq("id", id);
    },
    []
  );

  const addProcesso = useCallback(
    async (idx: number, nome: string) => {
      const item = proposalItens[idx];
      const existing = custos.filter((c) => c.item_index === idx);
      const { data } = await (supabase.from("orcamento_custos") as any)
        .insert({
          orcamento_id: orcamentoId,
          item_index: idx,
          item_nome: item?.produto || `Peça ${idx + 1}`,
          processo_nome: nome,
          valor_orcado: 0,
          valor_realizado: 0,
          ordem: existing.length,
        })
        .select()
        .single();
      if (data) setCustos((prev) => [...prev, data as OrcamentoCusto]);
    },
    [custos, orcamentoId, proposalItens]
  );

  const deleteProcesso = useCallback(async (id: string) => {
    await (supabase.from("orcamento_custos") as any).delete().eq("id", id);
    setCustos((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const saveParams = useCallback(
    async (newParams: ParamsFinanceiros) => {
      setParams(newParams);
      await (supabase.from("orcamento_params_financeiros") as any).upsert(
        { orcamento_id: orcamentoId, ...newParams },
        { onConflict: "orcamento_id" }
      );
    },
    [orcamentoId]
  );

  // ── Gerar processos padrão ────────────────────────────────────────────────
  const handleGerarPadrao = useCallback(
    async (idx: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: padroes } = await (supabase.from("processo_custo_padrao") as any)
        .select("nome, ordem")
        .eq("user_id", user.id)
        .order("ordem");

      if (!padroes || padroes.length === 0) {
        toast("Cadastre os processos padrão em Configurações → Processos de custo padrão");
        return;
      }

      const existing = custos.filter((c) => c.item_index === idx);
      if (existing.length > 0) {
        const ok = window.confirm("Isso irá adicionar os processos padrão aos existentes. Deseja continuar?");
        if (!ok) return;
      }

      setGerandoIdx(idx);
      const item = proposalItens[idx];
      const startOrdem = existing.length;
      const rows = (padroes as any[]).map((p, i) => ({
        orcamento_id: orcamentoId,
        item_index: idx,
        item_nome: item?.produto || `Peça ${idx + 1}`,
        processo_nome: p.nome,
        valor_orcado: 0,
        valor_realizado: 0,
        ordem: startOrdem + i,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: created } = await (supabase.from("orcamento_custos") as any)
        .insert(rows)
        .select();

      if (created) {
        setCustos((prev) => [...prev, ...(created as OrcamentoCusto[])]);
        toast.success(`${(created as any[]).length} processos padrão adicionados`);
      }
      setGerandoIdx(null);
    },
    [custos, orcamentoId, proposalItens]
  );

  const handleGerarTodas = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: padroes } = await (supabase.from("processo_custo_padrao") as any)
      .select("nome, ordem")
      .eq("user_id", user.id)
      .order("ordem");

    if (!padroes || padroes.length === 0) {
      toast("Cadastre os processos padrão em Configurações → Processos de custo padrão");
      return;
    }

    const ok = window.confirm(
      `Isso irá gerar os processos padrão para todas as ${proposalItens.length} peças. Confirmar?`
    );
    if (!ok) return;

    setGerandoTodas(true);
    const allRows = proposalItens.flatMap((item, idx) => {
      const existing = custos.filter((c) => c.item_index === idx);
      const startOrdem = existing.length;
      return (padroes as any[]).map((p, i) => ({
        orcamento_id: orcamentoId,
        item_index: idx,
        item_nome: item?.produto || `Peça ${idx + 1}`,
        processo_nome: p.nome,
        valor_orcado: 0,
        valor_realizado: 0,
        ordem: startOrdem + i,
      }));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created } = await (supabase.from("orcamento_custos") as any)
      .insert(allRows)
      .select();

    if (created) {
      setCustos((prev) => [...prev, ...(created as OrcamentoCusto[])]);
      toast.success(`Processos padrão gerados para todas as ${proposalItens.length} peças`);
    }
    setGerandoTodas(false);
  }, [custos, orcamentoId, proposalItens]);

  // ── Calculations ──────────────────────────────────────────────────────────
  const calcItem = useCallback(
    (idx: number): ItemCalc => {
      const itemCustos = custos.filter((c) => c.item_index === idx);
      const item = proposalItens[idx];
      const qtd = Number(item?.qtd) || 1;
      const valorUnit = Number(item?.valorUnit) || 0;

      // Unitários (por peça)
      const custoOrcUnitario = itemCustos.reduce((s, c) => s + Number(c.valor_orcado), 0);
      const custoRealUnitario = itemCustos.reduce((s, c) => s + Number(c.valor_realizado), 0);

      // Totais (× quantidade)
      const custoOrc = custoOrcUnitario * qtd;
      const custoReal = custoRealUnitario * qtd;
      const valorVenda = valorUnit * qtd;

      // Descontos sobre o valor de venda TOTAL
      const imposto = valorVenda * (params.imposto_pct / 100);
      const comissao = valorVenda * (params.comissao_pct / 100);
      const transporte = valorVenda * (params.transporte_pct / 100);
      const totalDescontos = imposto + comissao + transporte;

      // Lucro sobre totais
      const lucroOrcado = valorVenda - custoOrc - totalDescontos;
      const lucroReal = custoRealUnitario > 0 ? valorVenda - custoReal - totalDescontos : null;

      const markupReal = custoRealUnitario > 0 ? ((valorUnit / custoRealUnitario) - 1) * 100 : null;

      return { custoOrc, custoReal, valorVenda, totalDescontos, lucroOrcado, lucroReal, markupReal };
    },
    [custos, params, proposalItens]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Custos de Produção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-6">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (proposalItens.length === 0) return null;

  const PARAM_FIELDS: { key: keyof ParamsFinanceiros; label: string }[] = [
    { key: "imposto_pct", label: "Imposto %" },
    { key: "comissao_pct", label: "Comissão %" },
    { key: "transporte_pct", label: "Transporte %" },
    { key: "lucro_pct", label: "Lucro meta %" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Custos de Produção
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Parâmetros financeiros */}
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Parâmetros financeiros
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PARAM_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-muted-foreground">{label}</label>
                {canEditParams ? (
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={params[key]}
                    onChange={(e) => setParams((p) => ({ ...p, [key]: Number(e.target.value) }))}
                    onBlur={() => saveParams(params)}
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="h-8 flex items-center text-sm font-medium">{params[key]}%</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Aplicar padrão a todas */}
        {canEditOrcado && proposalItens.length > 1 && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              style={{ border: "0.5px solid #e5e5e5" }}
              onClick={handleGerarTodas}
              disabled={gerandoTodas}
            >
              {gerandoTodas
                ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                : <Zap className="w-3.5 h-3.5 mr-1" />
              }
              Aplicar padrão a todas as peças
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div>
          <div
            className="flex border-b"
            style={{ overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {proposalItens.map((item, idx) => {
              const label = item.produto || `Peça ${idx + 1}`;
              return (
                <button
                  key={idx}
                  onClick={() => handleTabClick(idx)}
                  title={label}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 ${
                    activeTab === idx
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {label}
                </button>
              );
            })}
            <button
              onClick={() => handleTabClick("resumo")}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors shrink-0 ${
                activeTab === "resumo"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Resumo
            </button>
          </div>

          {typeof activeTab === "number" && proposalItens[activeTab] && (
            <ItemTab
              key={activeTab}
              custos={custos.filter((c) => c.item_index === activeTab)}
              calc={calcItem(activeTab)}
              canEditOrcado={canEditOrcado}
              onUpdateCusto={updateCusto}
              onDeleteCusto={deleteProcesso}
              onAddProcesso={(nome) => addProcesso(activeTab, nome)}
              onGerarPadrao={() => handleGerarPadrao(activeTab)}
              isGerandoPadrao={gerandoIdx === activeTab}
            />
          )}

          {activeTab === "resumo" && (
            <ResumoTab
              proposalItens={proposalItens}
              calcItem={calcItem}
              params={params}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
