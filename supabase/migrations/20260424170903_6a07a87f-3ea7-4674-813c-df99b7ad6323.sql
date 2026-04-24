-- Tabela de contas bancárias sincronizadas via Pluggy
CREATE TABLE public.pluggy_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pluggy_account_id TEXT NOT NULL UNIQUE,
  pluggy_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  marketing_name TEXT,
  type TEXT,
  subtype TEXT,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  owner TEXT,
  tax_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pluggy_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_pluggy_accounts"
  ON public.pluggy_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_pluggy_accounts"
  ON public.pluggy_accounts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_pluggy_accounts"
  ON public.pluggy_accounts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_pluggy_accounts"
  ON public.pluggy_accounts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_pluggy_accounts_user ON public.pluggy_accounts(user_id);
CREATE INDEX idx_pluggy_accounts_item ON public.pluggy_accounts(pluggy_item_id);

CREATE TRIGGER set_pluggy_accounts_updated_at
  BEFORE UPDATE ON public.pluggy_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de transações sincronizadas via Pluggy
CREATE TABLE public.pluggy_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pluggy_transaction_id TEXT NOT NULL UNIQUE,
  pluggy_account_id TEXT NOT NULL,
  pluggy_item_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  category TEXT,
  category_pluggy TEXT,
  payment_method TEXT,
  type TEXT,
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pluggy_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_pluggy_transactions"
  ON public.pluggy_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_pluggy_transactions"
  ON public.pluggy_transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_pluggy_transactions"
  ON public.pluggy_transactions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_pluggy_transactions"
  ON public.pluggy_transactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_pluggy_transactions_user ON public.pluggy_transactions(user_id);
CREATE INDEX idx_pluggy_transactions_account ON public.pluggy_transactions(pluggy_account_id);
CREATE INDEX idx_pluggy_transactions_date ON public.pluggy_transactions(user_id, transaction_date DESC);

CREATE TRIGGER set_pluggy_transactions_updated_at
  BEFORE UPDATE ON public.pluggy_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();