CREATE TABLE orcamento_materiais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id uuid REFERENCES orcamentos(id) ON DELETE CASCADE,
  item_index integer NOT NULL,
  item_nome text NOT NULL,
  quantidade_peca integer DEFAULT 1,
  material text,
  tamanho text,
  quantidade_mp integer DEFAULT 1,
  valor_pago numeric(10,2),
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orcamento_materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticado gerencia materiais"
ON orcamento_materiais FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Fabricante gerencia materiais"
ON orcamento_materiais FOR ALL TO anon
USING (true) WITH CHECK (true);
