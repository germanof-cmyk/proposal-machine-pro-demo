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
import { PlusCircle, Trash2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrcamentoMaterial {
  id: string;
  orcamento_id: string;
  item_index: number;
  item_nome: string;
  quantidade_peca: number;
  material: string | null;
  tamanho: string | null;
  quantidade_mp: number;
  valor_pago: number | null;
  observacao: string | null;
}

export interface MateriaisProducaoProps {
  orcamentoId: string;
  proposalItens: { produto: string; qtd: number }[];
  canEdit?: boolean;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── ItemTab ──────────────────────────────────────────────────────────────────

function ItemTab({
  materiais,
  canEdit,
  onUpdate,
  onDelete,
  onAdd,
}: {
  materiais: OrcamentoMaterial[];
  canEdit: boolean;
  onUpdate: (id: string, field: keyof OrcamentoMaterial, value: string | number | null) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  const totalMateriais = materiais.reduce((s, m) => s + (Number(m.valor_pago) || 0) * (Number(m.quantidade_mp) || 1), 0);

  return (
    <div className="pt-4 space-y-4">
      {materiais.length > 0 && (
        <div className="flex justify-end">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Total materiais</p>
            <p className="text-base font-bold text-blue-600">{fmt(totalMateriais)}</p>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead className="w-24 text-right">Qtd. MP</TableHead>
              <TableHead className="w-32 text-right">Valor pago (R$)</TableHead>
              <TableHead>Observação</TableHead>
              {canEdit && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {materiais.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 6 : 5}
                  className="text-center text-xs text-muted-foreground py-6"
                >
                  Nenhum material cadastrado
                </TableCell>
              </TableRow>
            ) : (
              materiais.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    {canEdit ? (
                      <Input
                        defaultValue={m.material ?? ""}
                        onBlur={(e) => onUpdate(m.id, "material", e.target.value || null)}
                        className="h-7 text-sm"
                        placeholder="Ex: Aço 1020"
                      />
                    ) : (
                      <span className="text-sm">{m.material || "—"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Input
                        defaultValue={m.tamanho ?? ""}
                        onBlur={(e) => onUpdate(m.id, "tamanho", e.target.value || null)}
                        className="h-7 text-sm"
                        placeholder="Ex: 50x50x200"
                      />
                    ) : (
                      <span className="text-sm">{m.tamanho || "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit ? (
                      <Input
                        type="number"
                        min="1"
                        defaultValue={m.quantidade_mp}
                        onBlur={(e) => onUpdate(m.id, "quantidade_mp", Number(e.target.value))}
                        className="h-7 w-20 text-sm text-right ml-auto"
                      />
                    ) : (
                      <span className="text-sm">{m.quantidade_mp}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={m.valor_pago ?? ""}
                      onBlur={(e) =>
                        onUpdate(m.id, "valor_pago", e.target.value !== "" ? Number(e.target.value) : null)
                      }
                      className="h-7 w-28 text-sm text-right ml-auto"
                      placeholder="0,00"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      defaultValue={m.observacao ?? ""}
                      onBlur={(e) => onUpdate(m.id, "observacao", e.target.value || null)}
                      className="h-7 text-sm"
                      placeholder="Observação"
                    />
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(m.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {canEdit && (
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onAdd}>
          <PlusCircle className="w-3.5 h-3.5 mr-1" />
          Adicionar material
        </Button>
      )}
    </div>
  );
}

// ─── ResumoTab ────────────────────────────────────────────────────────────────

function ResumoTab({
  proposalItens,
  materiais,
}: {
  proposalItens: { produto: string; qtd: number }[];
  materiais: OrcamentoMaterial[];
}) {
  const rows = proposalItens.map((item, idx) => {
    const itemMateriais = materiais.filter((m) => m.item_index === idx);
    const totalMateriais = itemMateriais.reduce(
      (s, m) => s + (Number(m.valor_pago) || 0) * (Number(m.quantidade_mp) || 1),
      0
    );
    return {
      idx,
      nome: item.produto || `Peça ${idx + 1}`,
      count: itemMateriais.length,
      totalMateriais,
    };
  });

  const totalGeral = rows.reduce((s, r) => s + r.totalMateriais, 0);

  return (
    <div className="pt-4 space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Peça</TableHead>
              <TableHead className="text-right">Materiais</TableHead>
              <TableHead className="text-right">Total materiais</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.idx}>
                <TableCell className="text-sm">{r.nome}</TableCell>
                <TableCell className="text-right text-sm">{r.count}</TableCell>
                <TableCell className="text-right text-sm font-medium text-blue-600">
                  {fmt(r.totalMateriais)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{rows.reduce((s, r) => s + r.count, 0)}</TableCell>
              <TableCell className="text-right text-blue-600">{fmt(totalGeral)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── MateriaisProducao ────────────────────────────────────────────────────────

export function MateriaisProducao({
  orcamentoId,
  proposalItens,
  canEdit = true,
}: MateriaisProducaoProps) {
  const [materiais, setMateriais] = useState<OrcamentoMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<number | "resumo">(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await (supabase.from("orcamento_materiais") as any)
        .select("*")
        .eq("orcamento_id", orcamentoId)
        .order("created_at");
      if (!cancelled) {
        setMateriais((data ?? []) as OrcamentoMaterial[]);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [orcamentoId]);

  const updateMaterial = useCallback(
    async (id: string, field: keyof OrcamentoMaterial, value: string | number | null) => {
      setMateriais((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
      await (supabase.from("orcamento_materiais") as any).update({ [field]: value }).eq("id", id);
    },
    []
  );

  const addMaterial = useCallback(
    async (idx: number) => {
      const item = proposalItens[idx];
      const { data } = await (supabase.from("orcamento_materiais") as any)
        .insert({
          orcamento_id: orcamentoId,
          item_index: idx,
          item_nome: item?.produto || `Peça ${idx + 1}`,
          quantidade_peca: item?.qtd ?? 1,
          quantidade_mp: 1,
        })
        .select()
        .single();
      if (data) setMateriais((prev) => [...prev, data as OrcamentoMaterial]);
    },
    [orcamentoId, proposalItens]
  );

  const deleteMaterial = useCallback(async (id: string) => {
    await (supabase.from("orcamento_materiais") as any).delete().eq("id", id);
    setMateriais((prev) => prev.filter((m) => m.id !== id));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Materiais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-6">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (proposalItens.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Materiais
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Tabs */}
        <div
          className="flex border-b"
          style={{ overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {proposalItens.map((item, idx) => {
            const label = item.produto || `Peça ${idx + 1}`;
            return (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
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
            onClick={() => setActiveTab("resumo")}
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
            materiais={materiais.filter((m) => m.item_index === activeTab)}
            canEdit={canEdit}
            onUpdate={updateMaterial}
            onDelete={deleteMaterial}
            onAdd={() => addMaterial(activeTab)}
          />
        )}

        {activeTab === "resumo" && (
          <ResumoTab proposalItens={proposalItens} materiais={materiais} />
        )}
      </CardContent>
    </Card>
  );
}
