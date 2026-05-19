import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Orcamento {
  id: string;
  proposal_id: string;
  valor_fechado: number;
  prazo_entrega: string | null;
  prazo_pagamento: number;
  comissao_percent: number;
  material_entregue: boolean;
  material_entregue_em: string | null;
  client_token: string | null;
  data_inicio_producao: string | null;
  numero_pc: string | null;
  finalizado: boolean;
  finalizado_em: string | null;
  numero_nf: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrcamentoArquivo {
  id: string;
  orcamento_id: string;
  tipo: string;
  nome: string;
  storage_path: string;
  created_at: string;
}

export interface OrcamentoFinanceiro {
  id: string;
  orcamento_id: string;
  parcela: number;
  valor: number;
  data_prevista: string | null;
  recebido: boolean;
  data_recebimento: string | null;
  created_at: string;
}

export interface ProposalRow {
  id: string;
  numero: string;
  emitido_em: string;
  valido_ate: string;
  cliente: Record<string, string>;
  itens: Array<{ id: string; produto: string; qtd: number; valorUnit: number }>;
  desconto: number;
  frete: number;
  forma_pagamento: string;
  status: string;
  valor_fechado: number;
}

export function useOrcamento(proposalId: string) {
  const [proposal, setProposal] = useState<ProposalRow | null>(null);
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [arquivos, setArquivos] = useState<OrcamentoArquivo[]>([]);
  const [financeiro, setFinanceiro] = useState<OrcamentoFinanceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: prop, error: propError } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", proposalId)
        .single();

      if (propError || !prop) throw new Error("Proposta não encontrada");
      setProposal(prop as ProposalRow);

      let { data: orc } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("proposal_id", proposalId)
        .maybeSingle();

      if (!orc) {
        const { data: created, error: createErr } = await supabase
          .from("orcamentos")
          .insert({
            proposal_id: proposalId,
            valor_fechado: Number(prop.valor_fechado) || 0,
          })
          .select()
          .single();
        if (createErr) throw createErr;
        orc = created;
      }

      setOrcamento(orc as Orcamento);

      const { data: arqs } = await supabase
        .from("orcamento_arquivos")
        .select("*")
        .eq("orcamento_id", orc!.id)
        .order("created_at");
      setArquivos((arqs || []) as OrcamentoArquivo[]);

      const { data: fin } = await supabase
        .from("orcamento_financeiro")
        .select("*")
        .eq("orcamento_id", orc!.id)
        .order("parcela");
      setFinanceiro((fin || []) as OrcamentoFinanceiro[]);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar orçamento");
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    if (proposalId) fetchData();
  }, [fetchData, proposalId]);

  const updateOrcamento = useCallback(
    async (updates: Partial<Orcamento>) => {
      if (!orcamento) return;
      const { data, error } = await supabase
        .from("orcamentos")
        .update(updates)
        .eq("id", orcamento.id)
        .select()
        .single();
      if (error) {
        toast.error("Erro ao salvar");
        return;
      }
      setOrcamento(data as Orcamento);
    },
    [orcamento]
  );

  const uploadArquivo = useCallback(
    async (file: File, tipo: string) => {
      if (!orcamento) return;
      setUploading(true);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${orcamento.id}/${tipo}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("orcamentos")
        .upload(path, file);
      if (uploadError) {
        toast.error("Erro no upload: " + uploadError.message);
        setUploading(false);
        return;
      }
      const { data, error } = await supabase
        .from("orcamento_arquivos")
        .insert({
          orcamento_id: orcamento.id,
          tipo,
          nome: file.name,
          storage_path: path,
        })
        .select()
        .single();
      if (error) toast.error("Erro ao registrar arquivo");
      else setArquivos((prev) => [...prev, data as OrcamentoArquivo]);
      setUploading(false);
    },
    [orcamento]
  );

  const downloadArquivo = useCallback(async (arquivo: OrcamentoArquivo) => {
    const { data, error } = await supabase.storage
      .from("orcamentos")
      .createSignedUrl(arquivo.storage_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Erro ao gerar link de download");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }, []);

  const deleteArquivo = useCallback(async (arquivo: OrcamentoArquivo) => {
    await supabase.storage.from("orcamentos").remove([arquivo.storage_path]);
    const { error } = await supabase
      .from("orcamento_arquivos")
      .delete()
      .eq("id", arquivo.id);
    if (error) {
      toast.error("Erro ao excluir arquivo");
      return;
    }
    setArquivos((prev) => prev.filter((a) => a.id !== arquivo.id));
    toast.success("Arquivo excluído");
  }, []);

  const addParcela = useCallback(async () => {
    if (!orcamento) return;
    const nextNum =
      financeiro.length > 0
        ? Math.max(...financeiro.map((p) => p.parcela)) + 1
        : 1;
    const { data, error } = await supabase
      .from("orcamento_financeiro")
      .insert({
        orcamento_id: orcamento.id,
        parcela: nextNum,
        valor: 0,
      })
      .select()
      .single();
    if (error) {
      toast.error("Erro ao adicionar parcela");
      return;
    }
    setFinanceiro((prev) =>
      [...prev, data as OrcamentoFinanceiro].sort((a, b) => a.parcela - b.parcela)
    );
  }, [orcamento, financeiro]);

  const updateParcela = useCallback(
    async (id: string, updates: Partial<OrcamentoFinanceiro>) => {
      const { data, error } = await supabase
        .from("orcamento_financeiro")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        toast.error("Erro ao atualizar parcela");
        return;
      }
      setFinanceiro((prev) =>
        prev.map((p) => (p.id === id ? (data as OrcamentoFinanceiro) : p))
      );
    },
    []
  );

  const deleteParcela = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("orcamento_financeiro")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao excluir parcela");
      return;
    }
    setFinanceiro((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return {
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
  };
}
