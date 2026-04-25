-- Tabela de orçamentos mensais por categoria.
-- Cada usuário define um limite (em BRL) por categoria efetiva (rótulo PT-BR
-- proveniente do catálogo Pluggy ou override manual). Um threshold de alerta
-- (0–1) controla quando dispararemos avisos visuais na UI.
CREATE TABLE public.category_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_label TEXT NOT NULL,
  monthly_limit NUMERIC NOT NULL CHECK (monthly_limit >= 0),
  alert_threshold NUMERIC NOT NULL DEFAULT 0.8 CHECK (alert_threshold > 0 AND alert_threshold <= 1),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Apenas um orçamento por (usuário, categoria).
CREATE UNIQUE INDEX category_budgets_user_label_uniq
  ON public.category_budgets (user_id, category_label);

ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_category_budgets"
  ON public.category_budgets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_category_budgets"
  ON public.category_budgets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_category_budgets"
  ON public.category_budgets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_category_budgets"
  ON public.category_budgets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_category_budgets_updated_at
  BEFORE UPDATE ON public.category_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime para refletir alterações instantaneamente na UI.
ALTER PUBLICATION supabase_realtime ADD TABLE public.category_budgets;