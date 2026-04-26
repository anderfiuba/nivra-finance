-- Adiciona suporte hierárquico (pai/filha) aos orçamentos por categoria.
ALTER TABLE public.category_budgets
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'parent',
  ADD COLUMN IF NOT EXISTS parent_category_label text NULL;

-- Garante valores válidos via trigger (CHECK estático seria suficiente, mas trigger
-- também valida que parent_category_label existe quando scope='child').
CREATE OR REPLACE FUNCTION public.validate_category_budget_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.scope NOT IN ('parent','child') THEN
    RAISE EXCEPTION 'scope deve ser parent ou child';
  END IF;
  IF NEW.scope = 'child' AND (NEW.parent_category_label IS NULL OR length(trim(NEW.parent_category_label)) = 0) THEN
    RAISE EXCEPTION 'parent_category_label é obrigatório quando scope=child';
  END IF;
  IF NEW.scope = 'parent' THEN
    NEW.parent_category_label := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_category_budget_scope_trg ON public.category_budgets;
CREATE TRIGGER validate_category_budget_scope_trg
  BEFORE INSERT OR UPDATE ON public.category_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_category_budget_scope();