-- ── Adiciona client_token em orcamentos ─────────────────────────
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS client_token UUID DEFAULT gen_random_uuid();

-- Garante que linhas existentes tenham token
UPDATE public.orcamentos
  SET client_token = gen_random_uuid()
  WHERE client_token IS NULL;

-- ── Políticas anon para a página pública do cliente ──────────────

-- Leitura de orcamentos via token (token é o controle de acesso)
DROP POLICY IF EXISTS "Anon read orcamentos by token" ON public.orcamentos;
CREATE POLICY "Anon read orcamentos by token"
  ON public.orcamentos FOR SELECT TO anon
  USING (client_token IS NOT NULL);

-- Leitura de proposals (necessário para o join na view do cliente)
DROP POLICY IF EXISTS "Anon read proposals" ON public.proposals;
CREATE POLICY "Anon read proposals"
  ON public.proposals FOR SELECT TO anon
  USING (true);

-- Leitura de arquivos (necessário para listar PC/NF na view do cliente)
DROP POLICY IF EXISTS "Anon read orcamento_arquivos" ON public.orcamento_arquivos;
CREATE POLICY "Anon read orcamento_arquivos"
  ON public.orcamento_arquivos FOR SELECT TO anon
  USING (true);

-- Download de arquivos do storage sem autenticação
DROP POLICY IF EXISTS "Anon read orcamentos storage" ON storage.objects;
CREATE POLICY "Anon read orcamentos storage"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'orcamentos');
