-- Permitir dias de ciclo de 1 a 31 (preferência do usuário).
-- A normalização para o último dia válido do mês é feita em runtime no app.
ALTER TABLE public.card_cycle_settings
  DROP CONSTRAINT IF EXISTS card_cycle_settings_closing_day_check,
  DROP CONSTRAINT IF EXISTS card_cycle_settings_due_day_check;

ALTER TABLE public.card_cycle_settings
  ADD CONSTRAINT card_cycle_settings_closing_day_check
    CHECK (closing_day IS NULL OR (closing_day >= 1 AND closing_day <= 31)),
  ADD CONSTRAINT card_cycle_settings_due_day_check
    CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_cycle_day_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cycle_day_check
    CHECK (cycle_day >= 1 AND cycle_day <= 31);