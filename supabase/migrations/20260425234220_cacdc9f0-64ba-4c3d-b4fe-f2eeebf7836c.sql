CREATE TABLE public.card_cycle_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pluggy_account_id text NOT NULL,
  closing_day smallint CHECK (closing_day BETWEEN 1 AND 28),
  due_day smallint CHECK (due_day BETWEEN 1 AND 28),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pluggy_account_id)
);

ALTER TABLE public.card_cycle_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_card_cycle_settings"
  ON public.card_cycle_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_card_cycle_settings"
  ON public.card_cycle_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_card_cycle_settings"
  ON public.card_cycle_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_card_cycle_settings"
  ON public.card_cycle_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_card_cycle_settings_updated_at
  BEFORE UPDATE ON public.card_cycle_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_card_cycle_settings_user ON public.card_cycle_settings (user_id);