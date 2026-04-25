## Contexto

A página atual mostra **uma fatura por vez** (com seletor de cartão e detalhamento de transações). O PDF mostra uma estrutura **muito diferente**:

1. **Topo:** card "Total a pagar" agregando todos os cartões, com breakdown.
2. **Banner:** convite para informar dias de fechamento/vencimento dos cartões que faltam.
3. **Ciclos de Faturamento:** uma linha por **ciclo** mostrando estado (`Fechada` / `Ciclo atual` / `Aberta`), valor, datas, contadores. Mistura faturas reais (Pluggy) com **ciclo atual estimado** (somando transações desde o último fechamento).
4. **Próximas Faturas:** ciclos futuros já com parcelas alocadas.
5. **Recentemente Pagas:** faturas com status pago/fechado.

Decisões confirmadas com você:
- **Dias de fechamento/vencimento:** Open Finance traz quando disponível (a Pluggy popula `balance_close_date`/`balance_due_date` automaticamente). Para cartões manuais ou quando esses campos vierem `null`, o usuário informa pelo banner.
- **Recorrentes:** **não exibir** agora — breakdown será só **Parcelas** + **Compras avulsas**.
- **Pagas:** status vem da Pluggy (`paid=true` ou ciclo já fechado e antigo). Sem inferência manual.

## Mudanças no banco

### Nova tabela `card_cycle_settings` (migração)

Persiste `closing_day` e `due_day` informados pelo usuário, **com fallback** para os campos da Pluggy quando ausentes.

```sql
CREATE TABLE public.card_cycle_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pluggy_account_id text NOT NULL,
  closing_day smallint CHECK (closing_day BETWEEN 1 AND 28),
  due_day smallint CHECK (due_day BETWEEN 1 AND 28),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pluggy_account_id)
);

ALTER TABLE public.card_cycle_settings ENABLE ROW LEVEL SECURITY;

-- RLS: SELECT/INSERT/UPDATE/DELETE WHERE auth.uid() = user_id
-- Trigger update_updated_at_column
```

## Novos arquivos

### `src/lib/cardCycle.ts` — utilitário puro
- `resolveCycleDays(account, manualSetting)` → `{ closingDay, dueDay } | null` priorizando manual > Pluggy.
- `computeCurrentCycleRange(closingDay, ref)` → `{ start, end }` do ciclo aberto.
- `computeNextDueDate(dueDay, cycleEnd)` → próximo vencimento (regra: se `dueDay >= closingDay`, vence no mesmo mês do fechamento; senão, no mês seguinte).
- `formatShortDate(date)` → `"08/05"`.
- `daysUntil(date)` → número de dias até o vencimento.

### `src/components/faturas/TotalPagarCard.tsx`
Card grande no topo: valor agregado + linhas Parcelas / Compras avulsas (sem Recorrentes). Recebe lista pré-calculada de "ciclos abertos a pagar" (fatura fechada não-paga + ciclo atual estimado de cada cartão).

### `src/components/faturas/ConfigCiclosCard.tsx`
Banner com lista de cartões **sem** `closingDay`/`dueDay` resolvido. Cada linha tem dois inputs `Select 1-28` para fechamento e vencimento + botão check ✓ que faz upsert em `card_cycle_settings`. Banner desaparece quando todos cartões estão configurados (estado oculto via localStorage para não reabrir após dispensa).

### `src/components/faturas/CicloRow.tsx`
Item visual padrão do PDF: logo do conector + nome do cartão + badge de status (`Fechada`/`Ciclo atual`/`Paga`/`Vencida`) à esquerda; valor à direita; segunda linha com `Ciclo: dd/MM - dd/MM · Venc: dd/MM · Pgto mín: R$ X` + contadores `N parcelas · M compras`; rodapé com timeline simples (data início — data vencimento) e link "Ver transações →" que expande detalhes inline (reusa lógica atual de avulsas/parcelas).

### `src/pages/app/Faturas.tsx` — reescrito
Quatro seções renderizadas em sequência:
1. `<TotalPagarCard />`
2. `<ConfigCiclosCard />` (condicional)
3. **Ciclos de Faturamento** — para cada cartão: (a) última fatura fechada não-paga (se existir) + (b) ciclo atual estimado. Ordenadas por proximidade do vencimento.
4. **Próximas Faturas** — bills futuras (`due_date > próximo vencimento estimado`) ou ciclos N+1 quando há parcelas alocadas.
5. **Recentemente Pagas** — bills com `paid=true` OU `due_date < hoje - 7 dias` (versão compacta, sem expansão).

## Mudanças em arquivos existentes

### `src/contexts/FinanceContext.tsx`
- Buscar `card_cycle_settings` do usuário no `loadAll()` e expor via context (`cardCycleSettings: Record<pluggyAccountId, {closingDay, dueDay}>`).
- Função `upsertCardCycle(pluggyAccountId, closingDay, dueDay)` para o banner usar.
- **Sem mudança no realtime** (settings raramente mudam).

### `src/integrations/supabase/types.ts`
Regenerado automaticamente após a migração — não editar manualmente.

## Lógica de cálculo do "ciclo atual estimado"

Para cada cartão CREDIT:
1. Resolver `closingDay`/`dueDay` (manual > Pluggy). Se ambos `null` → cartão entra apenas no banner de configuração e **não** aparece em "Ciclos de Faturamento".
2. `currentCycle = computeCurrentCycleRange(closingDay, hoje)` → janela `[fechamento_anterior+1, próximo_fechamento]`.
3. Filtrar `transactions` desse `pluggyAccountId` cujo `transaction_date` está em `currentCycle` e `type = 'DEBIT'`.
4. Total estimado = soma dos `amount` dessas transações **menos** créditos de estorno.
5. Breakdown: usa `installment_number IS NOT NULL` (banco já tem o campo confiável) → parcelas vs avulsas. Heurística regex atual será **descartada**.

## Pontos não resolvidos / ressalvas

- **Ciclo atual ≠ fatura oficial.** Mostrar tooltip "Baseado nas transações do ciclo atual. O valor oficial aparece quando o banco enviar a fatura." (igual PDF).
- **Cartão `gold` do usuário hoje** tem `balance_close_date = null` mas `balance_due_date = 2026-04-08` → o banner pedirá só o dia de fechamento.
- **Múltiplos cartões:** layout funciona; testaremos no viewport mobile (375px) garantindo que o valor não quebre embaixo do nome.
- **"Recentemente Pagas"** ficará pouco populada hoje (Pluggy não marca pago). Listaremos faturas vencidas há mais de 7 dias com tooltip explicativo.

## Resumo de arquivos

**Novos:**
- migração SQL `create_card_cycle_settings.sql`
- `src/lib/cardCycle.ts`
- `src/components/faturas/TotalPagarCard.tsx`
- `src/components/faturas/ConfigCiclosCard.tsx`
- `src/components/faturas/CicloRow.tsx`

**Editados:**
- `src/contexts/FinanceContext.tsx`
- `src/pages/app/Faturas.tsx` (reescrita completa)
