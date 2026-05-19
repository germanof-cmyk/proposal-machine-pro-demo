import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export interface PortalMateriaisTabProps {
  orcamentoId: string;
  numeroPc?: string | null;
  proposalItens: { produto: string; qtd: number }[];
  empresa: {
    razao_social: string;
    cnpj: string;
    cidade: string;
    estado: string;
  };
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── PortalMateriaisTab ───────────────────────────────────────────────────────

export function PortalMateriaisTab({
  orcamentoId,
  numeroPc,
  proposalItens,
  empresa,
}: PortalMateriaisTabProps) {
  const [materiais, setMateriais] = useState<OrcamentoMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await (supabase.from("orcamento_materiais") as any)
        .select("*")
        .eq("orcamento_id", orcamentoId)
        .order("item_index");

      if (cancelled) return;

      let rows = (data ?? []) as OrcamentoMaterial[];

      // Auto-initialize one row per proposal item if none exist
      if (rows.length === 0 && proposalItens.length > 0) {
        const inserts = proposalItens.map((item, idx) => ({
          orcamento_id: orcamentoId,
          item_index: idx,
          item_nome: item.produto || `Item ${idx + 1}`,
          quantidade_peca: item.qtd ?? 1,
          quantidade_mp: 1,
        }));
        const { data: created } = await (supabase.from("orcamento_materiais") as any)
          .insert(inserts)
          .select()
          .order("item_index");
        if (!cancelled) {
          rows = (created ?? []) as OrcamentoMaterial[];
        }
      }

      if (!cancelled) {
        setMateriais(rows);
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [orcamentoId, proposalItens]);

  const updateField = useCallback(
    async (
      id: string,
      field: keyof OrcamentoMaterial,
      value: string | number | null,
      itemIndex: number
    ) => {
      setMateriais((prev) =>
        prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
      );
      await (supabase.from("orcamento_materiais") as any)
        .update({ [field]: value })
        .eq("id", id);

      // When valor_pago changes, sync to orcamento_custos MP process for this item
      if (field === "valor_pago") {
        await (supabase.from("orcamento_custos") as any)
          .update({ valor_realizado: value ?? 0 })
          .eq("orcamento_id", orcamentoId)
          .eq("item_index", itemIndex)
          .eq("processo_nome", "MP");
      }
    },
    [orcamentoId]
  );

  const exportarPDF = useCallback(() => {
    const preenchidos = materiais.filter((m) => m.material);
    const totalValor = materiais.reduce(
      (s, m) => s + (Number(m.valor_pago) || 0),
      0
    );
    const hoje = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
    const pcText = numeroPc ? `PC ${numeroPc}` : "";

    const linhas = materiais
      .map(
        (m) => `
      <tr>
        <td>${m.item_nome}</td>
        <td>${m.material || "—"}</td>
        <td style="text-align:center">${m.tamanho || "—"}</td>
        <td style="text-align:center">${m.quantidade_mp}</td>
        <td style="text-align:right">${
          m.valor_pago != null ? fmt(Number(m.valor_pago)) : "—"
        }</td>
        <td>${m.observacao || ""}</td>
      </tr>`
      )
      .join("");

    const janela = window.open("", "_blank");
    if (!janela) return;

    janela.document.write(`
      <html>
      <head>
        <title>Lista de Material${pcText ? " · " + pcText : ""}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #000; font-size: 12px; }
          h1 { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
          .sub { color: #666; font-size: 11px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
               padding: 8px 10px; border-bottom: 1px solid #000; text-align: left; }
          td { font-size: 12px; padding: 7px 10px; border-bottom: 0.5px solid #ddd; }
          .total-row td { font-weight: 700; border-top: 1px solid #000; border-bottom: none; }
          .footer { margin-top: 20px; font-size: 11px; color: #666;
                    border-top: 1px solid #ddd; padding-top: 12px; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>
        <h1>Lista de Material</h1>
        <div class="sub">${[pcText, hoje, `${preenchidos.length} de ${materiais.length} preenchidos`].filter(Boolean).join(" · ")}</div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Material</th>
              <th style="text-align:center">Tamanho (mm)</th>
              <th style="text-align:center">Qtd.</th>
              <th style="text-align:right">Valor pago</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            ${linhas}
            <tr class="total-row">
              <td colspan="4">Total</td>
              <td style="text-align:right">${fmt(totalValor)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <div class="footer">
          ${empresa.razao_social} · CNPJ ${empresa.cnpj} · ${empresa.cidade} ${empresa.estado}
        </div>
      </body>
      </html>
    `);
    janela.document.close();
    setTimeout(() => janela.print(), 400);
  }, [materiais, numeroPc, empresa]);

  if (loading) {
    return (
      <div
        className="bg-white rounded-xl p-8 text-center"
        style={{ border: "0.5px solid #e5e5e5" }}
      >
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const preenchidos = materiais.filter((m) => m.material);
  const totalValor = materiais.reduce(
    (s, m) => s + (Number(m.valor_pago) || 0),
    0
  );

  const inputStyle: React.CSSProperties = {
    height: 32,
    fontSize: 12,
    padding: "4px 8px",
    border: "0.5px solid #e5e5e5",
    borderRadius: 6,
    width: "100%",
    background: "#fff",
    outline: "none",
    fontFamily: "inherit",
    color: "#111",
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 13, color: "#888", whiteSpace: "nowrap" }}>
          {preenchidos.length} de {materiais.length} materiais preenchidos
        </span>
        <Button
          size="sm"
          className="h-8 text-xs bg-black hover:bg-black/80 text-white shrink-0"
          onClick={exportarPDF}
        >
          <FileDown className="w-3.5 h-3.5 mr-1.5" />
          Exportar PDF
        </Button>
      </div>

      {/* Table */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "0.5px solid #e5e5e5",
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            <col style={{ width: "auto" }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 30 }} />
          </colgroup>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "0.5px solid #f0f0f0" }}>
              {["Item", "Material", "Tamanho (mm)", "Qtde", "Valor pago", "Observação", ""].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: "8px 10px",
                    textAlign: "left",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.06em",
                    color: "#888",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {materiais.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{ padding: 32, textAlign: "center", fontSize: 13, color: "#aaa" }}
                >
                  Nenhum item encontrado
                </td>
              </tr>
            ) : (
              materiais.map((m, idx) => (
                <tr
                  key={m.id}
                  style={{ borderTop: idx > 0 ? "0.5px solid #f5f5f5" : undefined }}
                >
                  {/* Item */}
                  <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 500, wordBreak: "break-word", lineHeight: 1.4 }}>
                    {m.item_nome}
                  </td>

                  {/* Material */}
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      key={`mat-${m.id}`}
                      defaultValue={m.material ?? ""}
                      onBlur={(e) => updateField(m.id, "material", e.target.value || null, m.item_index)}
                      style={inputStyle}
                      placeholder="AÇO D2"
                    />
                  </td>

                  {/* Tamanho */}
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      key={`tam-${m.id}`}
                      defaultValue={m.tamanho ?? ""}
                      onBlur={(e) => updateField(m.id, "tamanho", e.target.value || null, m.item_index)}
                      style={inputStyle}
                      placeholder="50x100x200"
                    />
                  </td>

                  {/* Quantidade */}
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      key={`qtd-${m.id}`}
                      type="number"
                      min="1"
                      defaultValue={m.quantidade_mp}
                      onBlur={(e) => updateField(m.id, "quantidade_mp", Number(e.target.value), m.item_index)}
                      style={{ ...inputStyle, textAlign: "center" }}
                    />
                  </td>

                  {/* Valor pago */}
                  <td style={{ padding: "6px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: "#888", flexShrink: 0 }}>R$</span>
                      <input
                        key={`val-${m.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={m.valor_pago ?? ""}
                        onBlur={(e) =>
                          updateField(m.id, "valor_pago", e.target.value !== "" ? Number(e.target.value) : null, m.item_index)
                        }
                        style={{ ...inputStyle, width: 80, textAlign: "right" }}
                        placeholder="0,00"
                      />
                    </div>
                  </td>

                  {/* Observação */}
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      key={`obs-${m.id}`}
                      defaultValue={m.observacao ?? ""}
                      onBlur={(e) => updateField(m.id, "observacao", e.target.value || null, m.item_index)}
                      style={inputStyle}
                      placeholder="Obs."
                    />
                  </td>

                  {/* Status dot */}
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: m.material ? "#16a34a" : "#eab308",
                        margin: "0 auto",
                      }}
                      title={m.material ? "Preenchido" : "Não preenchido"}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "#888", padding: "0 4px" }}>
        <span>{materiais.length} {materiais.length === 1 ? "item" : "itens"}</span>
        <span style={{ fontWeight: 600, color: "#111" }}>{fmt(totalValor)}</span>
      </div>
    </div>
  );
}
