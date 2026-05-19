
ALTER TABLE public.proposals
  ADD COLUMN status TEXT NOT NULL DEFAULT 'aberta',
  ADD COLUMN valor_fechado NUMERIC NOT NULL DEFAULT 0;
