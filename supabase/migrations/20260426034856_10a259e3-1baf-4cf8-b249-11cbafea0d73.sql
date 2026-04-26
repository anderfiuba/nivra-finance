-- Tabela administrativa para guardar configurações usadas pelo cron interno.
-- Nenhum usuário tem acesso (RLS habilitado e nenhuma policy criada).
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

-- Atualiza a função para ler de app_settings (security definer bypassa RLS).
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
  select value into v_url from public.app_settings where key = 'sync_url';
  select value into v_key from public.app_settings where key = 'service_key';

  if v_url is null or v_key is null then
    raise notice 'app_settings.sync_url ou app_settings.service_key não configurados';
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