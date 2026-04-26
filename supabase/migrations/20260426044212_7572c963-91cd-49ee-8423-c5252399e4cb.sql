-- Tabela para guardar o limite mensal TOTAL de gastos do usuário.
-- Um único registro por usuário (UNIQUE em user_id).
CREATE TABLE public.total_budget_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  monthly_limit NUMERIC NOT NULL CHECK (monthly_limit > 0),
  alert_threshold NUMERIC NOT NULL DEFAULT 0.8 CHECK (alert_threshold > 0 AND alert_threshold <= 1),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.total_budget_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_total_budget"
  ON public.total_budget_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_total_budget"
  ON public.total_budget_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_total_budget"
  ON public.total_budget_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_total_budget"
  ON public.total_budget_settings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Trigger para updated_at usando função existente
CREATE TRIGGER update_total_budget_settings_updated_at
  BEFORE UPDATE ON public.total_budget_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();