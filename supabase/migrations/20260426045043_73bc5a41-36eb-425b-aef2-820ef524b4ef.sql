ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cycle_day SMALLINT NOT NULL DEFAULT 1
  CHECK (cycle_day >= 1 AND cycle_day <= 28);