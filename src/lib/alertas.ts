import { supabase } from "@/integrations/supabase/client";

export interface AlertaPayload {
  tipo: "etapa_concluida" | "orcamento_finalizado";
  orcamento_id: string;
  processo_id?: string;
  etapa_nome?: string;
  orcamento_numero: string;
  empresa_nome: string;
  company_id: string;
  proxima_etapa?: string;
  numero_pc?: string;
  numero_nf?: string;
  finalizado_em?: string;
}

export async function dispararAlerta(payload: AlertaPayload) {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.functions as any).invoke("enviar-alerta", {
      body: payload,
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });
    if (error) console.error("Erro ao disparar alerta:", error);
    console.log("Resultado alerta:", data);
    return data;
  } catch (err) {
    console.error("Erro ao chamar edge function:", err);
  }
}
