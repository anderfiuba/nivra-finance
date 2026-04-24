
-- 1) Tabela profiles ligada a auth.users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_insert_own_profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Função e trigger: cria profile automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Limpar dados demo de pluggy_items
DELETE FROM public.pluggy_items WHERE client_user_id = 'demo-user';

-- 4) Adicionar user_id em pluggy_items
ALTER TABLE public.pluggy_items
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_pluggy_items_user_id ON public.pluggy_items(user_id);

-- 5) Tornar user_id obrigatório (já não há linhas)
ALTER TABLE public.pluggy_items ALTER COLUMN user_id SET NOT NULL;

-- 6) Remover políticas demo permissivas
DROP POLICY IF EXISTS "demo_select_pluggy_items" ON public.pluggy_items;
DROP POLICY IF EXISTS "demo_insert_pluggy_items" ON public.pluggy_items;
DROP POLICY IF EXISTS "demo_update_pluggy_items" ON public.pluggy_items;
DROP POLICY IF EXISTS "demo_delete_pluggy_items" ON public.pluggy_items;

-- 7) Políticas estritas: cada usuário só vê/manipula suas conexões
CREATE POLICY "users_select_own_pluggy_items"
  ON public.pluggy_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_pluggy_items"
  ON public.pluggy_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_pluggy_items"
  ON public.pluggy_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_pluggy_items"
  ON public.pluggy_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
