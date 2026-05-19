-- Atualizar linhas existentes que ainda têm os valores padrão antigos
UPDATE orcamento_params_financeiros
SET
  imposto_pct   = 12  WHERE imposto_pct   = 16;

UPDATE orcamento_params_financeiros
SET
  comissao_pct  = 7   WHERE comissao_pct  = 5;

UPDATE orcamento_params_financeiros
SET
  lucro_pct     = 20  WHERE lucro_pct     = 7;
