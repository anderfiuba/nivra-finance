
## 1. Sincronização Open Finance — automática 2× ao dia, sem botão manual

### 1.1. Agendamento no banco (pg_cron + pg_net)

Criar uma migração que:
- Habilita as extensões `pg_cron` e `pg_net` (idempotente).
- Cria uma função SQL `public.trigger_pluggy_sync_all()` que itera todos os `pluggy_items` ativos e dispara, para cada um, uma chamada HTTP assíncrona via `net.http_post` para a edge function **`pluggy-sync-data`** (passando `itemId` no body). A função usa `SECURITY DEFINER` e roda com a service role.
- Agenda dois jobs `cron.schedule`:
  - `pluggy-sync-morning` → `0 3 * * *` (03:00 UTC = 00:00 BRT)
  - `pluggy-sync-evening` → `0 15 * * *` (15:00 UTC = 12:00 BRT)
  - Cada job chama `select public.trigger_pluggy_sync_all();`
- Antes de criar, faz `cron.unschedule` defensivo se já existirem (para suportar re-execução).

> Como `pg_net` precisa do JWT/anon key para chamar a edge function autenticada, o job vai usar a **service role key** lida de `vault.decrypted_secrets` (já há `SUPABASE_SERVICE_ROLE_KEY` configurado). Como recomendado pela documentação interna, a SQL com URL/secret será aplicada via **insert tool** (não via migration), porque carrega dados específicos do projeto.

Plano de SQL (a ser dividido em migration + insert/seed):

**Migration (estrutura):**
```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

create or replace function public.trigger_pluggy_sync_all()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select distinct pluggy_item_id
    from public.pluggy_items
    where pluggy_item_id is not null
  loop
    perform net.http_post(
      url     := current_setting('app.settings.sync_url', true),
      headers := jsonb_build_object(
                   'Content-Type','application/json',
                   'Authorization', 'Bearer ' || current_setting('app.settings.service_key', true)
                 ),
      body    := jsonb_build_object('itemId', r.pluggy_item_id, 'source', 'cron')
    );
  end loop;
end;
$$;
```

**Insert tool (configuração com dados sensíveis e agendamento):**
```sql
alter database postgres set "app.settings.sync_url" = 'https://pmnqukoifdqiiyctyoof.supabase.co/functions/v1/pluggy-sync-data';
alter database postgres set "app.settings.service_key" = '<SERVICE_ROLE_KEY>';
-- (Substituído em runtime; não comitado em migrations)

select cron.unschedule('pluggy-sync-morning') where exists (select 1 from cron.job where jobname='pluggy-sync-morning');
select cron.unschedule('pluggy-sync-evening') where exists (select 1 from cron.job where jobname='pluggy-sync-evening');

select cron.schedule('pluggy-sync-morning', '0 3 * * *',  $$ select public.trigger_pluggy_sync_all(); $$);
select cron.schedule('pluggy-sync-evening', '0 15 * * *', $$ select public.trigger_pluggy_sync_all(); $$);
```

> **Atenção sobre `ALTER DATABASE`:** as instruções globais proíbem migrations contendo `ALTER DATABASE postgres`. Por isso esses dois `ALTER DATABASE ... SET` ficam **fora da migration**, executados via insert tool no projeto atual (não viajam em remix), igual à prática recomendada para cron jobs.

### 1.2. Edge function `pluggy-sync-data` aceita chamada cron

A função hoje exige `verify_jwt = true` e usa `auth.uid()` via RLS para resolver o usuário do item. Para o cron funcionar precisamos:

- Em `supabase/config.toml`, manter a função `pluggy-sync-data` chamável com **service role** (a service role key passa no `Authorization: Bearer` e é aceita como JWT válido pelo gateway). Não é preciso desativar `verify_jwt` — service role key é um JWT válido.
- No código da função, ajustar o trecho que resolve o `user_id` do item: hoje deduz pelo `auth.uid()` + RLS; precisa **ler `user_id` direto da tabela `pluggy_items`** usando service-role client quando o caller é cron (sem `auth.uid()`). Detecta cron por `body.source === "cron"` ou pela ausência de `auth.uid()`.

Alteração resumida em `supabase/functions/pluggy-sync-data/index.ts`:
- Após autenticar, tentar `supabaseUserClient.auth.getUser()`. Se vazio → assumir cron, buscar `user_id` do item via service role.
- Validar que o item existe e pertence a algum usuário antes de prosseguir. Sem isso, recusar.

Sem mudanças em `pluggy-sync-item` (refresh remoto) — a `pluggy-sync-data` já chama o necessário internamente; o refresh extra do botão manual sai junto.

### 1.3. Remover toda a UI/lógica de sincronização manual

Em `src/pages/app/Conexoes.tsx`:
- Remover `handleSync`, `syncingId`, `setSyncingId`.
- Remover o `<Button>` "Sincronizar" e o `<Button>` topo "Atualizar" (recarregar lista). A própria realtime + revalidação ao montar já cuida — mas vamos manter um pequeno botão **"Atualizar lista"** somente para recarregar os metadados do banco (não chama Pluggy). Mais leve, sem `RefreshCw` confuso.
- Remover `import { RefreshCw }` não usado e qualquer referência a `pluggy-sync-item` no client (não há outras hoje).
- Adicionar um aviso fixo abaixo do header explicando a regra:

  > _"Suas contas são sincronizadas automaticamente **2 vezes ao dia** (00:00 e 12:00, horário de Brasília). Novas transações aparecerão em todas as telas — extrato, dashboard, categorias e faturas — assim que chegarem."_

Em `supabase/functions/`:
- A função `pluggy-sync-item` é hoje chamada apenas pelo botão removido. Manter o arquivo? **Remover** (delete) para limpar a base, junto com a entrada em `supabase/config.toml`. (A sync-data já solicita o refresh implicitamente ao puxar dados; se for preciso forçar refresh remoto, o cron pode evoluir depois.)

### 1.4. Atualização em cadeia já é coberta

`FinanceContext` já assina realtime em `pluggy_transactions / pluggy_accounts / pluggy_bills / category_budgets` e chama `refresh()`. Como o cron grava nessas tabelas via `pluggy-sync-data`, **extrato, dashboard, faturas e categorias atualizam automaticamente** sem nenhuma alteração extra. Garantido.

---

## 2. Dashboard novo — claro, conciso, mobile-first

Reescrita de `src/pages/app/Dashboard.tsx` inspirada na referência (Visor) mas usando nossos tokens. Layout em **uma coluna no mobile**, **2 colunas no md+**, **3 colunas no lg+**.

### 2.1. Estrutura (top → bottom)

1. **Header compacto** — saudação + label do ciclo (já existe, manter enxuto).

2. **Linha de KPIs** (4 cards no desktop, grid 2×2 no mobile):
   - **Patrimônio** (substitui "Saldo consolidado") — soma `balance` de contas com `type !== 'CREDIT'` + `automatically_invested_balance` quando presente + futuras contas com `type === 'INVESTMENT'`. Cartões ficam fora. Subtítulo em `text-xs`: `"Contas + investimentos · cartões não incluídos"`.
   - **Entradas no ciclo** — `cycleTotals.entradas`, trend vs ciclo anterior.
   - **Saídas no ciclo** — `cycleTotals.saidas`, trend.
   - **Resultado do ciclo** — `cycleTotals.saldo`, trend, cor verde/vermelha.

   Nova função utilitária no `FinanceContext`: `netWorth` calculado a partir de `accounts`:
   ```ts
   const netWorth = useMemo(() => {
     return accounts.reduce((sum, a) => {
       const type = (a.type ?? "").toUpperCase();
       if (type === "CREDIT") return sum;        // ignora cartões
       const invested = a.automaticallyInvestedBalance ?? 0;   // novo campo
       return sum + (a.balance ?? 0) + invested;
     }, 0);
   }, [accounts]);
   ```
   Para isso adicionar `automatically_invested_balance` no SELECT de `pluggy_accounts` e no tipo `FinanceAccount`. Hoje a coluna existe na tabela mas não é trazida.

3. **Card grande "Resultado do ciclo"** (ocupa col-span-2 no lg) — gráfico de área com **entradas (verde)** e **saídas (vermelha)** ao longo dos dias do ciclo. Componente Recharts `AreaChart` com 2 séries empilhadas. Vazio: mensagem clara, sem skeleton fake.

4. **Card "Despesas por categoria"** (col 3 no lg) — donut Recharts já existe; manter, mas renomear título para "Principais categorias do ciclo" e mostrar legenda das **top 4** com **valor + % do total**. Click eventualmente leva para `/app/categorizacao` (link "Ver detalhes →" no header).

5. **Card "Orçamentos no mês"** (col-span-2 no lg) — lista compacta de até 4 `budgetProgress`, ordenados pelos mais críticos (over → alert → ok). Cada linha: ícone, nome, barra (`Progress`), `R$ gasto / R$ limite`, badge de status. Vazio: CTA "Definir orçamentos" → `/app/categorizacao`.

6. **Card "Faturas do mês"** (col 3) — usando `bills` filtrados pelo ciclo atual:
   - Total agregado em destaque.
   - Lista de até 3 cartões com nome (do `accounts` via `pluggyAccountId`) + valor da fatura atual.
   - Link "Ver todas →" para `/app/faturas`.
   - Vazio: "Nenhuma fatura em aberto neste mês."

7. **Card "Movimentações recentes"** (full width) — já existe; manter mas:
   - Top 8 transações.
   - Badge da categoria (cor de `CATEGORY_COLORS`) próxima ao nome — visual igual à referência.
   - Mobile: layout vertical (descrição em cima, badge + valor embaixo).

### 2.2. Otimização mobile

- Todos os cards: `p-4 md:p-6`, títulos `text-sm md:text-base`, números `text-xl md:text-2xl`.
- KPIs: grid `grid-cols-2 lg:grid-cols-4`, ícones menores no mobile (`h-3.5 md:h-4`).
- Gráficos: `height={180}` no mobile, `height={240}` no md+. Donut com `innerRadius={45}` no mobile.
- Lista de transações: hover só no md+; no mobile `divide-y divide-border` com `py-3` para toque confortável.
- Aviso de sincronização (texto pequeno) no rodapé do dashboard:
  > _"Atualizamos seus dados automaticamente 2× ao dia (00:00 e 12:00 BRT)."_

### 2.3. Itens removidos do dashboard atual

- Card "Evolução do saldo (Aguardando dados)" → substituído pelo card de Resultado do ciclo (tem dado real desde já).
- Card "Receitas vs Despesas (Comparativo mensal)" → também placeholder; será reaproveitado em iteração futura.
- Card "Insights com IA" → fora do escopo desta entrega; remover por agora para não poluir.

> Sobre **Faturas no dashboard**: você não respondeu na pergunta, mas como a referência destaca esse bloco e ele agrega muito valor (você já tem cartões conectados), vou **incluir** o card. Se preferir um dashboard ainda mais enxuto, basta pedir e ele sai numa próxima iteração.

---

## 3. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<novo>.sql` | Cria `trigger_pluggy_sync_all()`, habilita `pg_cron`/`pg_net` |
| `supabase/functions/pluggy-sync-data/index.ts` | Aceita chamada via service role (cron); resolve `user_id` direto do item |
| `supabase/functions/pluggy-sync-item/` | **Apagar** pasta (não há mais consumidor) |
| `supabase/config.toml` | Remove bloco `[functions.pluggy-sync-item]` |
| `src/pages/app/Conexoes.tsx` | Remove `handleSync`, botão "Sincronizar"; adiciona aviso de sync automática 2×/dia |
| `src/pages/app/Dashboard.tsx` | Reescrita: KPIs (Patrimônio + ciclo), Resultado do ciclo, Categorias, Orçamentos, Faturas, Recentes |
| `src/contexts/FinanceContext.tsx` | Adiciona `netWorth`, traz `automatically_invested_balance` no SELECT, expõe no `FinanceAccount` |
| `src/integrations/supabase/types.ts` | Auto-regenerado após migration (não editamos) |

**Insert tool (em separado, com dados do projeto):**
- Configura `app.settings.sync_url` e `app.settings.service_key`.
- `cron.schedule` dos dois jobs `0 3 * * *` e `0 15 * * *`.

Sem novas dependências. Sem mudanças nas tabelas (somente seleção de colunas existentes).
