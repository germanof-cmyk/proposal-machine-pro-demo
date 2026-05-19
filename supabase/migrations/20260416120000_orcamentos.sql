
-- ================================================================
-- Update existing tables to require authentication (RLS hardening)
-- ================================================================

-- proposals
DROP POLICY IF EXISTS "Allow all read" ON public.proposals;
DROP POLICY IF EXISTS "Allow all insert" ON public.proposals;
DROP POLICY IF EXISTS "Allow all update" ON public.proposals;
DROP POLICY IF EXISTS "Allow all delete" ON public.proposals;
CREATE POLICY "Auth read proposals"   ON public.proposals FOR SELECT    TO authenticated USING (true);
CREATE POLICY "Auth insert proposals" ON public.proposals FOR INSERT    TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update proposals" ON public.proposals FOR UPDATE    TO authenticated USING (true);
CREATE POLICY "Auth delete proposals" ON public.proposals FOR DELETE    TO authenticated USING (true);

-- clients
DROP POLICY IF EXISTS "Allow all read" ON public.clients;
DROP POLICY IF EXISTS "Allow all insert" ON public.clients;
DROP POLICY IF EXISTS "Allow all update" ON public.clients;
CREATE POLICY "Auth read clients"   ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update clients" ON public.clients FOR UPDATE TO authenticated USING (true);

-- ================================================================
-- Storage bucket for orcamento files
-- ================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('orcamentos', 'orcamentos', false, 52428800)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth upload orcamentos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'orcamentos');

CREATE POLICY "Auth read orcamentos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'orcamentos');

CREATE POLICY "Auth update orcamentos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'orcamentos');

CREATE POLICY "Auth delete orcamentos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'orcamentos');

-- ================================================================
-- orcamentos table
-- ================================================================

CREATE TABLE public.orcamentos (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id         UUID        NOT NULL UNIQUE REFERENCES public.proposals(id) ON DELETE CASCADE,
  valor_fechado       NUMERIC     NOT NULL DEFAULT 0,
  prazo_entrega       DATE,
  comissao_percent    NUMERIC     NOT NULL DEFAULT 0,
  material_entregue   BOOLEAN     NOT NULL DEFAULT false,
  material_entregue_em DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth all orcamentos" ON public.orcamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_orcamentos_updated_at
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================================
-- orcamento_arquivos table
-- ================================================================

CREATE TABLE public.orcamento_arquivos (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id UUID        NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  tipo         TEXT        NOT NULL DEFAULT 'outro',  -- PC | NF | outro
  nome         TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orcamento_arquivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth all orcamento_arquivos" ON public.orcamento_arquivos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================================
-- orcamento_financeiro table
-- ================================================================

CREATE TABLE public.orcamento_financeiro (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id     UUID        NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  parcela          INTEGER     NOT NULL,
  valor            NUMERIC     NOT NULL DEFAULT 0,
  data_prevista    DATE,
  recebido         BOOLEAN     NOT NULL DEFAULT false,
  data_recebimento DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orcamento_financeiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth all orcamento_financeiro" ON public.orcamento_financeiro FOR ALL TO authenticated USING (true) WITH CHECK (true);
