-- Tabela: custos orçado vs realizado por processo/item
CREATE TABLE IF NOT EXISTS orcamento_custos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id uuid REFERENCES orcamentos(id) ON DELETE CASCADE,
  item_index integer NOT NULL,
  item_nome text NOT NULL,
  processo_nome text NOT NULL,
  valor_orcado numeric(10,2) DEFAULT 0,
  valor_realizado numeric(10,2) DEFAULT 0,
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela: parâmetros financeiros por orçamento
CREATE TABLE IF NOT EXISTS orcamento_params_financeiros (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id uuid REFERENCES orcamentos(id) ON DELETE CASCADE UNIQUE,
  imposto_pct numeric(5,2) DEFAULT 16,
  comissao_pct numeric(5,2) DEFAULT 5,
  lucro_pct numeric(5,2) DEFAULT 7,
  markup_pct numeric(5,2) DEFAULT 35,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela: processos de custo padrão por usuário
CREATE TABLE IF NOT EXISTS processo_custo_padrao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer DEFAULT 0
);

-- RLS
ALTER TABLE orcamento_custos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento_params_financeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE processo_custo_padrao ENABLE ROW LEVEL SECURITY;

-- orcamento_custos: representante tem acesso total; fabricante (portal) pode ler e editar realizado
CREATE POLICY "Autenticado gerencia custos"
  ON orcamento_custos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Fabricante gerencia realizado"
  ON orcamento_custos FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY "Fabricante lê custos"
  ON orcamento_custos FOR SELECT TO anon
  USING (true);

-- orcamento_params_financeiros: apenas autenticado
CREATE POLICY "Autenticado gerencia params"
  ON orcamento_params_financeiros FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Fabricante lê params"
  ON orcamento_params_financeiros FOR SELECT TO anon
  USING (true);

-- processo_custo_padrao: cada usuário gerencia os seus
CREATE POLICY "Usuário gerencia processos custo"
  ON processo_custo_padrao FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Processos padrão iniciais (serão inseridos pelo representante via UI)
-- INSERT INTO processo_custo_padrao (user_id, nome, ordem) VALUES ...
