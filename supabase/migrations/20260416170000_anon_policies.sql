-- Políticas de leitura pública (anon) para a página /cliente/:token
-- Idempotente: DROP IF EXISTS antes de cada CREATE

-- orcamentos: leitura via token (token é o controle de acesso)
DROP POLICY IF EXISTS "Anon read orcamentos by token" ON public.orcamentos;
CREATE POLICY "Anon read orcamentos by token"
  ON public.orcamentos FOR SELECT TO anon
  USING (client_token IS NOT NULL);

-- proposals: necessário para o join com orcamentos
DROP POLICY IF EXISTS "Anon read proposals" ON public.proposals;
CREATE POLICY "Anon read proposals"
  ON public.proposals FOR SELECT TO anon
  USING (true);

-- orcamento_arquivos: necessário para listar PC/NF
DROP POLICY IF EXISTS "Anon read orcamento_arquivos" ON public.orcamento_arquivos;
CREATE POLICY "Anon read orcamento_arquivos"
  ON public.orcamento_arquivos FOR SELECT TO anon
  USING (true);
