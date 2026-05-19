ALTER TABLE orcamento_params_financeiros
  ADD COLUMN IF NOT EXISTS transporte_pct numeric(5,2) DEFAULT 5;

-- Atualizar os padrões para novos valores
ALTER TABLE orcamento_params_financeiros
  ALTER COLUMN imposto_pct SET DEFAULT 12,
  ALTER COLUMN comissao_pct SET DEFAULT 7,
  ALTER COLUMN lucro_pct SET DEFAULT 20;
