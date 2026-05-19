import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Proposal, ProposalClient, ProposalItem } from "@/types/proposal";
import { toast } from "sonner";

const toDbRow = (p: Proposal) => ({
  numero: p.numero,
  emitido_em: p.emitidoEm,
  valido_ate: p.validoAte,
  cliente: JSON.parse(JSON.stringify(p.cliente)),
  itens: JSON.parse(JSON.stringify(p.itens)),
  desconto: p.desconto,
  frete: p.frete,
  forma_pagamento: p.formaPagamento,
  observacoes_frete: p.observacoesFrete,
  outras_observacoes: p.outrasObservacoes,
  criado_por: p.criadoPor,
  status: p.status,
  valor_fechado: p.valorFechado,
});

const fromDbRow = (row: any): Proposal => ({
  id: row.id,
  numero: row.numero,
  emitidoEm: row.emitido_em,
  validoAte: row.valido_ate,
  cliente: row.cliente as ProposalClient,
  itens: row.itens as ProposalItem[],
  desconto: Number(row.desconto),
  frete: Number(row.frete),
  formaPagamento: row.forma_pagamento,
  observacoesFrete: row.observacoes_frete,
  outrasObservacoes: row.outras_observacoes,
  criadoPor: row.criado_por,
  status: row.status || "aberta",
  valorFechado: Number(row.valor_fechado) || 0,
});

export const useProposals = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProposals = useCallback(async () => {
    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching proposals:", error);
      toast.error("Erro ao carregar propostas");
      return;
    }
    setProposals((data || []).map(fromDbRow));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const saveProposal = async (proposal: Proposal): Promise<Proposal | null> => {
    const { data: existing } = await supabase
      .from("proposals")
      .select("id")
      .eq("id", proposal.id)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("proposals")
        .update(toDbRow(proposal))
        .eq("id", proposal.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating proposal:", error);
        toast.error("Erro ao salvar proposta");
        return null;
      }
      const updated = fromDbRow(data);
      setProposals((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      toast.success("Proposta salva!");
      return updated;
    } else {
      const { data, error } = await supabase
        .from("proposals")
        .insert(toDbRow(proposal))
        .select()
        .single();

      if (error) {
        console.error("Error inserting proposal:", error);
        toast.error("Erro ao salvar proposta");
        return null;
      }
      const created = fromDbRow(data);
      setProposals((prev) => [created, ...prev]);
      toast.success("Proposta salva!");
      return created;
    }
  };

  const deleteProposal = async (id: string) => {
    const { error } = await supabase.from("proposals").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir proposta");
      return;
    }
    setProposals((prev) => prev.filter((p) => p.id !== id));
    toast.success("Proposta excluída!");
  };

  const getNextNumber = () => {
    if (proposals.length === 0) return "00001";
    const maxNum = Math.max(...proposals.map((p) => parseInt(p.numero, 10) || 0));
    return String(maxNum + 1).padStart(5, "0");
  };

  return { proposals, loading, saveProposal, deleteProposal, fetchProposals, getNextNumber };
};
