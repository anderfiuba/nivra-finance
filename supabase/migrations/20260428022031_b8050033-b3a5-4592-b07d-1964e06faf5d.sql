-- ============================================================
-- Tabela pluggy_investments
-- Armazena investimentos retornados pelo endpoint /investments da Pluggy
-- (https://docs.pluggy.ai/reference/investments). Universal para todos os
-- conectores PF que expõem esse recurso (CDB, Tesouro, Fundos, Ações, etc.).
-- ============================================================
CREATE TABLE public.pluggy_investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pluggy_investment_id TEXT NOT NULL,
  pluggy_item_id TEXT NOT NULL,
  -- Algumas posições estão associadas a uma "account" (ex: corretora);
  -- outras vêm soltas no item. Mantemos opcional.
  pluggy_account_id TEXT,
  -- Identidade do ativo
  name TEXT NOT NULL,
  code TEXT,
  isin TEXT,
  -- Classificação Pluggy: type (FIXED_INCOME, EQUITY, MUTUAL_FUND, ETF, SECURITY, COE, ...)
  type TEXT,
  subtype TEXT,
  -- Posição financeira
  balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
  amount NUMERIC(18, 4),
  amount_original NUMERIC(18, 4),
  amount_profit NUMERIC(18, 4),
  amount_withdrawal NUMERIC(18, 4),
  quantity NUMERIC(18, 6),
  value NUMERIC(18, 6),
  rate NUMERIC(18, 6),
  rate_type TEXT,
  fixed_annual_rate NUMERIC(18, 6),
  -- Datas e instituição
  date DATE,
  due_date DATE,
  issue_date DATE,
  issuer TEXT,
  issuer_id TEXT,
  status TEXT,
  currency TEXT NOT NULL DEFAULT 'BRL',
  tax_number TEXT,
  owner TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pluggy_investments_pluggy_id_key UNIQUE (pluggy_investment_id)
);

CREATE INDEX idx_pluggy_investments_user ON public.pluggy_investments (user_id);
CREATE INDEX idx_pluggy_investments_item ON public.pluggy_investments (pluggy_item_id);
CREATE INDEX idx_pluggy_investments_account ON public.pluggy_investments (pluggy_account_id);

ALTER TABLE public.pluggy_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_pluggy_investments"
ON public.pluggy_investments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_pluggy_investments"
ON public.pluggy_investments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_pluggy_investments"
ON public.pluggy_investments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_pluggy_investments"
ON public.pluggy_investments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER set_pluggy_investments_updated_at
BEFORE UPDATE ON public.pluggy_investments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();