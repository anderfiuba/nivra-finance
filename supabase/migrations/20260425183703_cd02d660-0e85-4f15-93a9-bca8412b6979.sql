
-- 1. Pluggy accounts: novas colunas
ALTER TABLE public.pluggy_accounts
  ADD COLUMN IF NOT EXISTS credit_limit numeric,
  ADD COLUMN IF NOT EXISTS available_credit_limit numeric,
  ADD COLUMN IF NOT EXISTS balance_due_date date,
  ADD COLUMN IF NOT EXISTS balance_close_date date,
  ADD COLUMN IF NOT EXISTS minimum_payment numeric,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_level text,
  ADD COLUMN IF NOT EXISTS card_number_last4 text,
  ADD COLUMN IF NOT EXISTS bank_overdraft_limit numeric,
  ADD COLUMN IF NOT EXISTS bank_overdraft_used numeric,
  ADD COLUMN IF NOT EXISTS automatically_invested_balance numeric,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb;

-- 2. Pluggy transactions: novas colunas
ALTER TABLE public.pluggy_transactions
  ADD COLUMN IF NOT EXISTS amount_in_account_currency numeric,
  ADD COLUMN IF NOT EXISTS account_currency text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS category_id text,
  ADD COLUMN IF NOT EXISTS category_parent_id text,
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS total_installments integer,
  ADD COLUMN IF NOT EXISTS merchant_name text,
  ADD COLUMN IF NOT EXISTS operation_type text;

-- 3. Catálogo global de categorias Pluggy
CREATE TABLE IF NOT EXISTS public.pluggy_categories (
  id text PRIMARY KEY,
  description text NOT NULL,
  description_translated text,
  parent_id text,
  parent_description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pluggy_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_readable_by_authenticated" ON public.pluggy_categories;
CREATE POLICY "categories_readable_by_authenticated"
  ON public.pluggy_categories
  FOR SELECT
  TO authenticated
  USING (true);

-- Sem políticas de INSERT/UPDATE/DELETE: somente service role (edge function) escreve.

-- 4. Faturas de cartão de crédito
CREATE TABLE IF NOT EXISTS public.pluggy_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pluggy_bill_id text NOT NULL UNIQUE,
  pluggy_account_id text NOT NULL,
  pluggy_item_id text NOT NULL,
  due_date date,
  total_amount numeric,
  total_amount_currency text DEFAULT 'BRL',
  minimum_payment_amount numeric,
  allows_installments boolean,
  paid boolean DEFAULT false,
  raw_payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pluggy_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_pluggy_bills" ON public.pluggy_bills;
CREATE POLICY "users_select_own_pluggy_bills"
  ON public.pluggy_bills FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_pluggy_bills" ON public.pluggy_bills;
CREATE POLICY "users_insert_own_pluggy_bills"
  ON public.pluggy_bills FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_pluggy_bills" ON public.pluggy_bills;
CREATE POLICY "users_update_own_pluggy_bills"
  ON public.pluggy_bills FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_pluggy_bills" ON public.pluggy_bills;
CREATE POLICY "users_delete_own_pluggy_bills"
  ON public.pluggy_bills FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_pluggy_bills_updated_at ON public.pluggy_bills;
CREATE TRIGGER set_pluggy_bills_updated_at
  BEFORE UPDATE ON public.pluggy_bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_pluggy_bills_user ON public.pluggy_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_pluggy_bills_account ON public.pluggy_bills(pluggy_account_id);
