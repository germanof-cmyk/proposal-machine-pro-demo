CREATE TABLE IF NOT EXISTS orcamento_processos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id uuid REFERENCES orcamentos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  dias integer NOT NULL DEFAULT 1,
  ordem integer NOT NULL DEFAULT 0,
  concluido boolean DEFAULT false,
  concluido_em timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orcamento_processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticado gerencia processos"
  ON orcamento_processos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS data_inicio_producao date;
