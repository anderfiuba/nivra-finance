## Objetivo
Reformular o **Extrato Unificado** para:
1. Trazer **12 meses** de histórico da Pluggy (hoje só puxamos 90 dias).
2. Permitir **filtrar por mês** com um seletor de meses.
3. Mostrar um **resumo do mês** (Entradas, Saídas, Resultado) — como na imagem 1.
4. Otimizar a UI mobile com **card compacto + expansão de detalhes** — como na imagem 2 (e não como o atual da imagem 3, onde texto se sobrepõe).

Dados e padrões da Pluggy/UI atuais foram preservados — não inventamos campos nem mudamos a semântica de `amount`/`type`/`category`.

---

## 1. Backend — Sync de 12 meses (`supabase/functions/pluggy-sync-data/index.ts`)

A doc da Pluggy permite até 12 meses de transações por padrão (`from`/`to` no `/transactions`). Hoje o `fetchAllTransactions` está fixo em 90 dias.

**Mudança:**
```ts
// Antes: from.setDate(from.getDate() - 90);
// Depois:
const from = new Date();
from.setMonth(from.getMonth() - 12);
from.setDate(from.getDate() - 1); // pequena margem
```
- Aumenta o `safety` de páginas (`page > 20` → `page > 60`) para acomodar usuários com alto volume.
- Mantém o resto idêntico (paginação, upsert, preservação de `category` manual).
- Sem mudança em schema; a tabela `pluggy_transactions` já guarda o que precisamos.

**Reprocessar dados existentes:** após o deploy, sugerir ao usuário tocar em "Sincronizar agora" em **Conexões** para repuxar o histórico de 12 meses.

---

## 2. Contexto — não truncar a 1000 (`src/contexts/FinanceContext.tsx`)

Hoje a query traz `.limit(1000)` — pode cortar se um usuário tiver muitas transações em 12 meses.

**Mudança:**
- Subir limite para `5000` (cobre praticamente todos os casos para 12 meses; Supabase aceita até 1000 por padrão mas o `limit()` explícito sobrepõe).
- Manter ordenação por `transaction_date desc`.

Sem outras mudanças no contexto — o `effectiveCategory`, totais do ciclo, etc. permanecem.

---

## 3. Utilitário de mês calendário (`src/lib/months.ts` — novo)

Pequena função para gerar a lista dos últimos 12 meses calendário e formatar o label PT-BR ("Abr 25", "Mar 25"…).

```ts
export interface MonthBucket { key: string; label: string; year: number; month: number; start: Date; end: Date; }
export function lastNMonths(n: number, ref = new Date()): MonthBucket[] { /* ... */ }
export function monthKeyOf(iso: string): string { /* "YYYY-MM" */ }
```

Usado só pelo Extrato — Dashboard/Orçamentos continuam com `cycleDay` (ciclo de fatura).

---

## 4. Refatoração do Extrato (`src/pages/app/Extrato.tsx`)

### 4.1 Seletor de mês (filtro principal)
- Substituir o título por uma **linha de cabeçalho com `<Select>`** "Abr 25" + chips de navegação "‹ ›" para ir para mês anterior/próximo.
- Default: mês atual.
- Lista construída a partir dos próprios dados (`monthKeyOf(t.date)`) limitada a 12 meses.
- Filtros existentes (busca, conta, categoria) **continuam**, apenas reorganizados.

### 4.2 Card de resumo do mês (como imagem 1)
Componente novo `MonthSummaryCard` exibido logo abaixo do seletor:
- Linha única em mobile: `📋 N  ↓ R$ Entradas  ↑ R$ Saídas  ↕ ResultadoColorido`
- Versão desktop: 4 mini-cards.
- Calculado em `useMemo` filtrando `transactions` pelo bucket do mês selecionado.
- Cores: verde para entradas/saldo positivo, vermelho para saídas/saldo negativo (já temos `text-success` / `text-destructive`).

### 4.3 Lista de transações — card mobile expansível (como imagem 2)
Hoje a row tem `<Select>` de categoria + nome da conta + valor + data num único `flex` que estoura em 390 px.

**Novo layout mobile** (`< md`):
- Substituir a row por um **`<button>` linha clicável** com:
  - Ícone redondo da categoria (cor do `CATEGORY_COLORS`) à esquerda.
  - Coluna principal: descrição (1 linha truncada) + linha secundária `Categoria · ****1077` (small, muted).
  - À direita: **valor** em fonte semibold (vermelho/verde) + **data curta** (`24/04 21:52`) embaixo.
  - Sem `<Select>` visível na row — fica enxuto.
- Ao tocar, **expande inline** (Collapsible) revelando:
  - Conta completa + número
  - Categoria (aí sim com `<Select>` para editar)
  - Status (Pendente/Confirmada — vem de `t.status`)
  - Parcela `2/3` se `installment_number`/`total_installments` existirem
  - Merchant (`merchant_name`) se houver
  - Valor original em moeda estrangeira se `originalCurrency` existir (já mapeado).
- Em desktop (`≥ md`) mantemos uma versão tabular semelhante à atual, mas com as mesmas correções (descrição truncada, conta no lugar certo).

### 4.4 Estado vazio + paginação leve
- Se o mês selecionado não tem transações: mensagem "Nenhuma transação em Abr 25" com sugestão de trocar de mês.
- Render incremental simples: mostrar 100 itens iniciais + botão "Carregar mais" se passar disso (evita travar o mobile com listas grandes).

---

## 5. Arquivos afetados

**Editados:**
- `supabase/functions/pluggy-sync-data/index.ts` — janela de 90d → 12 meses.
- `src/contexts/FinanceContext.tsx` — `.limit(1000)` → `.limit(5000)`.
- `src/pages/app/Extrato.tsx` — refatorado conforme acima.

**Criados:**
- `src/lib/months.ts` — utilitário de buckets mensais.
- `src/components/extrato/MonthSelector.tsx` — seletor + setas.
- `src/components/extrato/MonthSummaryCard.tsx` — entradas/saídas/resultado.
- `src/components/extrato/TransactionRow.tsx` — row mobile expansível (e variante desktop).

Sem migração de banco. Sem mudança de schema. Sem novos secrets.

---

## 6. Pós-deploy
Após aplicar, basta o usuário entrar em **Conexões → Sincronizar agora** para que o backfill de 12 meses seja gravado. As transações antigas de 90 dias permanecem (upsert por `pluggy_transaction_id`).