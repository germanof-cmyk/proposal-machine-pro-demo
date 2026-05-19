-- Substitui a policy genérica por uma mais precisa:
-- permite ler proposals apenas quando existe um orcamento público vinculado
DROP POLICY IF EXISTS "Anon read proposals" ON public.proposals;

CREATE POLICY "Leitura publica de proposta via orcamento publico"
  ON public.proposals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orcamentos
      WHERE orcamentos.proposal_id = proposals.id
        AND orcamentos.client_token IS NOT NULL
    )
  );
