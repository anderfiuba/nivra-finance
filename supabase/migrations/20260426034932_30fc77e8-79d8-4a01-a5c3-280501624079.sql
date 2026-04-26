-- Configura URL e service key usadas pelo cron
INSERT INTO public.app_settings (key, value) VALUES
  ('sync_url', 'https://pmnqukoifdqiiyctyoof.supabase.co/functions/v1/pluggy-sync-data'),
  ('service_key', 'eyJhbGciOiJIUzI1NiIsImtpZCI6Im5pdnJhLWZpbmFuY2lhbC1jbGFyaXR5IiwidHlwIjoiSldUIn0.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtbnF1a29pZmRxaWl5Y3R5b29mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzA0MjM5MCwiZXhwIjoyMDkyNjE4MzkwfQ.placeholder')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Remove jobs antigos (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname IN ('pluggy-sync-morning','pluggy-sync-evening');
END $$;

-- Agenda 2x ao dia: 03:00 UTC (00:00 BRT) e 15:00 UTC (12:00 BRT)
SELECT cron.schedule('pluggy-sync-morning', '0 3 * * *',  $$ SELECT public.trigger_pluggy_sync_all(); $$);
SELECT cron.schedule('pluggy-sync-evening', '0 15 * * *', $$ SELECT public.trigger_pluggy_sync_all(); $$);