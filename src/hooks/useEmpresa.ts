import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EmpresaConfig {
  id?: string;
  nome: string;
  razao_social: string;
  cnpj: string;
  cidade: string;
  estado: string;
  telefone: string | null;
  email: string | null;
  site: string | null;
}

export const EMPRESA_DEFAULTS: EmpresaConfig = {
  nome: "3D Usinagem",
  razao_social: "3D Usinagem e Soluções Industriais",
  cnpj: "13.570.620/0001-08",
  cidade: "Joinville",
  estado: "SC",
  telefone: null,
  email: null,
  site: null,
};

export function useEmpresa() {
  const [empresa, setEmpresa] = useState<EmpresaConfig>(EMPRESA_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("empresa_config") as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) setEmpresa(data as EmpresaConfig);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { empresa, loading };
}
