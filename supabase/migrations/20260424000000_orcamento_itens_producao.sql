CREATE TABLE IF NOT EXISTS orcamento_itens_producao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id uuid REFERENCES orcamentos(id) ON DELETE CASCADE NOT NULL,
  item_index integer NOT NULL,
  item_nome text NOT NULL,
  quantidade_total integer NOT NULL DEFAULT 0,
  quantidade_produzida integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orcamento_itens_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticado gerencia itens producao"
  ON orcamento_itens_producao FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Fabricante atualiza itens producao"
  ON orcamento_itens_producao FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY "Leitura publica itens producao via portal_token"
  ON orcamento_itens_producao FOR SELECT
  USING (
    orcamento_id IN (
      SELECT o.id FROM orcamentos o
      JOIN proposals p ON p.id = o.proposal_id
      JOIN client_companies cc ON cc.id = p.client_company_id
      WHERE cc.portal_token IS NOT NULL
    )
  );
