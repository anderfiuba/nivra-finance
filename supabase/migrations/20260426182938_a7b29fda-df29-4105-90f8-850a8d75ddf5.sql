ALTER TABLE public.pluggy_items
  ADD COLUMN IF NOT EXISTS status_detail jsonb,
  ADD COLUMN IF NOT EXISTS last_sync_warning text;