
-- ==========================================================================
-- 1) Remover service_key gravado em texto plano em app_settings
-- ==========================================================================
DELETE FROM public.app_settings WHERE key = 'service_key';

-- ==========================================================================
-- 2) Atualizar trigger_pluggy_sync_all para usar CRON_SHARED_SECRET
--    via current_setting('app.settings.cron_secret', true) — configurado
--    fora do banco (Vault/Supabase Secrets), nunca persistido em tabela.
--    Envia o secret em header dedicado X-Cron-Secret.
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.trigger_pluggy_sync_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_url    text;
  v_secret text;
BEGIN
  -- URL da edge function continua em app_settings (não é segredo).
  SELECT value INTO v_url FROM public.app_settings WHERE key = 'sync_url';

  -- Segredo de cron vem de GUC configurado a nível de instância:
  --   ALTER DATABASE postgres SET app.settings.cron_secret = '<valor>';
  -- (operação manual, fora desta migration — feita pelo operador.)
  v_secret := current_setting('app.settings.cron_secret', true);

  IF v_url IS NULL OR v_secret IS NULL OR length(v_secret) = 0 THEN
    RAISE NOTICE 'cron sync abortado: app_settings.sync_url ou app.settings.cron_secret ausentes';
    RETURN;
  END IF;

  FOR r IN
    SELECT DISTINCT pluggy_item_id
    FROM public.pluggy_items
    WHERE pluggy_item_id IS NOT NULL
  LOOP
    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'X-Cron-Secret', v_secret
                 ),
      body    := jsonb_build_object('itemId', r.pluggy_item_id)
    );
  END LOOP;
END;
$$;

-- ==========================================================================
-- 3) app_settings: deny-by-default explícito.
--    A função SECURITY DEFINER acima continua funcionando (bypassa RLS).
--    Edge functions com service role também (não passam por RLS).
--    Mas usuários autenticados ficam bloqueados em qualquer operação.
-- ==========================================================================
DROP POLICY IF EXISTS app_settings_deny_all ON public.app_settings;
CREATE POLICY app_settings_deny_all
  ON public.app_settings
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- ==========================================================================
-- 4) Realtime: restringir assinatura de canais.
--    Cada usuário só pode receber mensagens em tópicos prefixados com seu
--    user_id (padrão "user:<uid>:*" ou apenas "<uid>:*").
--    Sem essa policy, qualquer authenticated assina qualquer canal.
-- ==========================================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS realtime_messages_user_scoped_select ON realtime.messages;
CREATE POLICY realtime_messages_user_scoped_select
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- Aceita tópicos no formato "user:<uid>:*" OU "<uid>:*"
    realtime.topic() LIKE ('user:' || auth.uid()::text || ':%')
    OR realtime.topic() LIKE (auth.uid()::text || ':%')
    OR realtime.topic() = ('user:' || auth.uid()::text)
    OR realtime.topic() = auth.uid()::text
  );

DROP POLICY IF EXISTS realtime_messages_user_scoped_insert ON realtime.messages;
CREATE POLICY realtime_messages_user_scoped_insert
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() LIKE ('user:' || auth.uid()::text || ':%')
    OR realtime.topic() LIKE (auth.uid()::text || ':%')
    OR realtime.topic() = ('user:' || auth.uid()::text)
    OR realtime.topic() = auth.uid()::text
  );
