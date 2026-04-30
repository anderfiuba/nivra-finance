ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_cpf_format_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cpf_format_check
  CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');

CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique_idx
  ON public.profiles (cpf)
  WHERE cpf IS NOT NULL;