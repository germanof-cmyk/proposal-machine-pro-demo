
CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL,
  emitido_em DATE NOT NULL,
  valido_ate DATE NOT NULL,
  cliente JSONB NOT NULL DEFAULT '{}',
  itens JSONB NOT NULL DEFAULT '[]',
  desconto NUMERIC NOT NULL DEFAULT 0,
  frete NUMERIC NOT NULL DEFAULT 0,
  forma_pagamento TEXT NOT NULL DEFAULT '',
  observacoes_frete TEXT NOT NULL DEFAULT '',
  outras_observacoes TEXT NOT NULL DEFAULT '',
  criado_por TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read" ON public.proposals FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.proposals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.proposals FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON public.proposals FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
