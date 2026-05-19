ALTER TABLE orcamentos
ADD COLUMN IF NOT EXISTS finalizado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS finalizado_em timestamptz,
ADD COLUMN IF NOT EXISTS numero_nf text;
