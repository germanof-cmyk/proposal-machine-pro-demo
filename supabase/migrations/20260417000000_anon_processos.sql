-- Leitura pública de processos para a página /cliente/:token
DROP POLICY IF EXISTS "Leitura pública de processos via token" ON public.orcamento_processos;
CREATE POLICY "Leitura pública de processos via token"
  ON public.orcamento_processos FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM orcamentos
      WHERE orcamentos.id = orcamento_processos.orcamento_id
        AND orcamentos.client_token IS NOT NULL
    )
  );
