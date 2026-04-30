CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_cpf text := NEW.raw_user_meta_data->>'cpf';
  safe_cpf text := NULL;
BEGIN
  IF meta_cpf IS NOT NULL AND meta_cpf ~ '^[0-9]{11}$' THEN
    safe_cpf := meta_cpf;
  END IF;

  INSERT INTO public.profiles (id, full_name, cpf)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    safe_cpf
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;