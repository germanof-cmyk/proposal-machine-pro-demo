import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProposalClient } from "@/types/proposal";

interface DbClient {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  cpf_cnpj: string;
  rg_ie: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

const fromDb = (r: DbClient): ProposalClient => ({
  nome: r.nome,
  telefone: r.telefone,
  email: r.email,
  cpfCnpj: r.cpf_cnpj,
  rgIe: r.rg_ie,
  endereco: r.endereco,
  bairro: r.bairro,
  cidade: r.cidade,
  estado: r.estado,
  cep: r.cep,
});

const toDb = (c: ProposalClient) => ({
  nome: c.nome,
  telefone: c.telefone,
  email: c.email,
  cpf_cnpj: c.cpfCnpj,
  rg_ie: c.rgIe,
  endereco: c.endereco,
  bairro: c.bairro,
  cidade: c.cidade,
  estado: c.estado,
  cep: c.cep,
});

export const useClients = () => {
  const [clients, setClients] = useState<ProposalClient[]>([]);

  const fetchClients = useCallback(async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("nome");
    if (data) setClients((data as unknown as DbClient[]).map(fromDb));
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const saveClient = async (client: ProposalClient) => {
    if (!client.nome.trim()) return;
    const row = toDb(client);
    // Upsert by nome
    await supabase
      .from("clients")
      .upsert(row, { onConflict: "nome" });
    fetchClients();
  };

  const findByName = (name: string): ProposalClient | undefined =>
    clients.find((c) => c.nome.toLowerCase() === name.toLowerCase());

  const searchByName = (query: string): ProposalClient[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return clients.filter((c) => c.nome.toLowerCase().includes(q));
  };

  return { clients, saveClient, findByName, searchByName };
};
