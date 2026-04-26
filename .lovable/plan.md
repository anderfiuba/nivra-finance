# Diagnóstico

A sincronização da conta corrente do Nubank não traz transações **por limitação do upstream**, não por bug nosso.

**Evidências objetivas:**
- Re-sync executado agora: `{ accounts: 2, transactions: 123, bills: 12 }`
- `pluggy_items.execution_status = PARTIAL_SUCCESS`
- Conta corrente (`type=BANK`): saldo R$ 765,77 mas **0 transações**
- Cartão (`type=CREDIT`): 123 transações OK

A função `pluggy-sync-data/index.ts` chama `/transactions?accountId=<id>` para **toda** conta retornada — não há filtro por tipo. Logo, o zero vem da Pluggy.

`PARTIAL_SUCCESS` no Nubank tipicamente indica que o produto **`ACCOUNTS_TRANSACTIONS`** (extrato da conta corrente) não foi autorizado ou falhou no Open Finance, enquanto **`CREDIT_CARDS`** foi autorizado. O saldo aparece porque vem com o produto `ACCOUNTS` básico; o extrato precisa do produto adicional.

---

# Plano de correção (escopo enxuto, foco em diagnóstico + reconnect)

## 1. Capturar diagnóstico do item no sync

**Arquivo:** `supabase/functions/pluggy-sync-data/index.ts`

Após `GET /items/:id`, persistir os campos da Pluggy que indicam o que falhou:
- `executionStatus` (já temos)
- `statusDetail` (objeto que detalha qual produto: `accounts`, `transactions`, `creditCards`, `identity`, com `isUpdated`, `lastUpdatedAt`, `warnings`).

Salvar em duas novas colunas em `pluggy_items`:
- `status_detail jsonb` — payload bruto do `statusDetail`.
- `last_sync_warning text` — string curta legível (ex.: `"transactions: outdated; accounts: not authorized"`) calculada a partir do `statusDetail`.

## 2. Migration

Criar migration adicionando:
```sql
ALTER TABLE public.pluggy_items
  ADD COLUMN IF NOT EXISTS status_detail jsonb,
  ADD COLUMN IF NOT EXISTS last_sync_warning text;
```

## 3. Expor no frontend (página Conexões)

**Arquivo:** `src/pages/app/Conexoes.tsx` + `src/components/contas/ConnectionRow.tsx`

Quando `execution_status !== 'SUCCESS'`:
- Mostrar badge âmbar `"Sincronização parcial"` ao lado do conector.
- Tooltip / linha expandida com `last_sync_warning` (ex.: "Extrato da conta corrente não autorizado no Open Finance").
- Botão **"Reconectar para liberar dados"** que dispara o widget da Pluggy via `pluggy-connect-token` em modo update, pré-marcando produtos faltantes.

## 4. Aviso no Dashboard (Histórico do Patrimônio)

**Arquivo:** `src/pages/app/Dashboard.tsx`

Hoje o card some quando não há variação. Trocar a mensagem genérica por algo acionável quando detectarmos `BANK` accounts com 0 transações:

> "A conta **Conta Corrente (Nubank)** não retornou extrato. Reconecte autorizando o produto Extrato no Open Finance para ver o histórico."

Com link direto para `/app/contas` (ou `/app/conexoes`) e botão "Reconectar agora".

## 5. Validação

Após reconectar, rodar `pluggy-sync-data` e checar:
- `execution_status = SUCCESS`
- `pluggy_transactions` da conta `3164778c-…` > 0
- Card de patrimônio volta a renderizar a série temporal.

---

## O que **não** vou fazer nesta entrega

- Não vou tratar cartão como patrimônio (você confirmou: manter só BANK).
- Não vou esconder o card no Dashboard sem explicação — vou sempre comunicar a causa.
- Não vou tocar em RLS, autenticação ou nas funções `account-export`/`account-delete`.

---

## Arquivos a editar

1. `supabase/migrations/<timestamp>_pluggy_items_status_detail.sql` (novo)
2. `supabase/functions/pluggy-sync-data/index.ts`
3. `src/integrations/supabase/types.ts` — atualiza automaticamente após migration
4. `src/contexts/FinanceContext.tsx` — expõe `partialSyncItems` derivado
5. `src/pages/app/Conexoes.tsx` + `src/components/contas/ConnectionRow.tsx`
6. `src/pages/app/Dashboard.tsx` — mensagem específica no card de patrimônio

## Risco

- **Baixo.** Mudanças aditivas (colunas novas, UI condicional). Nenhum fluxo existente quebra.
- O reconnect em si depende do widget da Pluggy retornar o item com produtos atualizados — caso o conector Nubank simplesmente não suporte `ACCOUNTS_TRANSACTIONS` para sua conta, a UI vai deixar isso claro em vez de "sumir" o gráfico.
