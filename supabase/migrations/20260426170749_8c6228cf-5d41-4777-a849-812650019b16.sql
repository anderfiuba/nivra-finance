-- Função de retenção LGPD (executável só por service_role via cron).
CREATE OR REPLACE FUNCTION public.lgpd_data_retention_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_tx_count int := 0;
  v_dead_items_count int := 0;
  v_result jsonb;
BEGIN
  -- 1. Apaga transações com > 24 meses (limite legal típico para extratos).
  WITH del AS (
    DELETE FROM public.pluggy_transactions
    WHERE transaction_date < (now() - interval '24 months')
    RETURNING user_id
  )
  SELECT count(*) INTO v_old_tx_count FROM del;

  -- 2. Apaga itens com LOGIN_ERROR > 90 dias (consentimento abandonado).
  -- Cascade implícito: contas/transações daquele item já caem por user_id.
  WITH del AS (
    DELETE FROM public.pluggy_items
    WHERE status IN ('LOGIN_ERROR','OUTDATED','WAITING_USER_INPUT')
      AND updated_at < (now() - interval '90 days')
    RETURNING user_id, pluggy_item_id
  )
  SELECT count(*) INTO v_dead_items_count FROM del;

  v_result := jsonb_build_object(
    'transactions_deleted', v_old_tx_count,
    'dead_items_deleted', v_dead_items_count,
    'executed_at', now()
  );

  -- Registra na trilha (system event — user_id null não permitido, então usamos
  -- um marcador especial: o próprio uuid zero não funcionaria com FK; aqui não
  -- temos FK, então usamos uuid_nil() para evento de sistema).
  -- Como audit_log requer user_id NOT NULL, registramos apenas se houver
  -- ao menos um afetado e usamos um uuid fixo de sistema.
  IF v_old_tx_count > 0 OR v_dead_items_count > 0 THEN
    INSERT INTO public.audit_log (user_id, event_type, event_details)
    VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      'system.data_retention',
      v_result
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Negar EXECUTE para anon/authenticated. Só service_role (via cron) executa.
REVOKE EXECUTE ON FUNCTION public.lgpd_data_retention_cleanup() FROM anon, authenticated, public;
