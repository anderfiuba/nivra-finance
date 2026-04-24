CREATE TABLE public.pluggy_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_user_id TEXT NOT NULL,
  pluggy_item_id TEXT NOT NULL UNIQUE,
  connector_id INTEGER,
  connector_name TEXT NOT NULL,
  connector_image_url TEXT,
  connector_primary_color TEXT,
  status TEXT,
  execution_status TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_pluggy_items_client_user ON public.pluggy_items(client_user_id);

ALTER TABLE public.pluggy_items ENABLE ROW LEVEL SECURITY;

-- Modo demo (sem auth ainda). Quando habilitarmos login, trocaremos por
-- USING (auth.uid()::text = client_user_id).
CREATE POLICY "demo_select_pluggy_items"
  ON public.pluggy_items FOR SELECT
  USING (true);

CREATE POLICY "demo_insert_pluggy_items"
  ON public.pluggy_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "demo_update_pluggy_items"
  ON public.pluggy_items FOR UPDATE
  USING (true);

CREATE POLICY "demo_delete_pluggy_items"
  ON public.pluggy_items FOR DELETE
  USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_pluggy_items_updated_at
BEFORE UPDATE ON public.pluggy_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();