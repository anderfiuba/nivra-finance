-- Habilita extensões necessárias para agendamento HTTP
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Função que dispara, para cada item Pluggy registrado, uma chamada à
-- edge function pluggy-sync-data. Roda como SECURITY DEFINER para
-- conseguir ler pluggy_items independentemente do invocador (cron).
create or replace function public.trigger_pluggy_sync_all()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_url text;
  v_key text;
begin
  v_url := current_setting('app.settings.sync_url', true);
  v_key := current_setting('app.settings.service_key', true);

  if v_url is null or v_key is null then
    raise notice 'app.settings.sync_url ou app.settings.service_key não configurados';
    return;
  end if;

  for r in
    select distinct pluggy_item_id
    from public.pluggy_items
    where pluggy_item_id is not null
  loop
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
                   'Content-Type','application/json',
                   'Authorization', 'Bearer ' || v_key
                 ),
      body    := jsonb_build_object('itemId', r.pluggy_item_id, 'source', 'cron')
    );
  end loop;
end;
$$;