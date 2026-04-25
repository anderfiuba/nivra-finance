
Investiguei o banco e o código. Os três problemas têm causas claras e correções pontuais — sem mocks, tudo continua usando a Pluggy.

---

## 1. Faturas — histórico não aparece

### Diagnóstico
- Em `pluggy_bills` existem **12 faturas** persistidas para o cartão `gold`, todas com `pluggy_account_id = "f6dafb7e-b7e3-478d-870c-3de742c73182"` (o id da Pluggy).
- Em `pluggy_accounts`, o `id` interno (UUID Supabase) do cartão é `2e284e62-…` e o id Pluggy fica em `pluggy_account_id`.
- Em `src/pages/app/Faturas.tsx` o filtro é:
  ```ts
  bills.filter(b => b.pluggyAccountId === selectedAccount.id)
  ```
  Mas `selectedAccount.id` é o **UUID interno** (`2e284e62-…`), enquanto `b.pluggyAccountId` é o **id Pluggy** (`f6dafb7e-…`). Eles nunca batem → lista vazia.
- O mesmo erro acontece no card-resumo (Limite, Vencimento) ao depender de `activeBill`.
- Há também uma comparação frágil em `billTxs`: `t.account !== (selectedAccount.marketingName || selectedAccount.name)` — `marketingName` do cartão `gold` é `null`, e `t.account` vem de `accountMap` que prioriza `marketing_name || name`, mas se houver homônimo entre BANK/CREDIT (caso típico no Nubank, com mesmo nome em conta e cartão) podem mesclar. Vou corrigir para comparar pelo id Pluggy da conta.

### Correção
**`src/contexts/FinanceContext.tsx`**
- Expor o `pluggyAccountId` no `FinanceAccount` (hoje só temos `id` interno).
- Na construção das transações, anexar `pluggyAccountId` como meta (`accountPluggyId`) ou, mais simples, expor um helper `accountById` no contexto.

**`src/pages/app/Faturas.tsx`**
- Trocar `b.pluggyAccountId === selectedAccount.id` por `b.pluggyAccountId === selectedAccount.pluggyAccountId`.
- Para `billTxs`, filtrar por `pluggyAccountId` da transação em vez de `t.account === name`. Vou adicionar `pluggyAccountId` ao tipo `Transaction` (já temos no SELECT, falta propagar).

Resultado: histórico de 12 meses aparece imediatamente, sem novo sync.

---

## 2. Orçamentos — não detectam gasto da categoria escolhida

### Diagnóstico
- Em `pluggy_categories`, `Food and drinks` (id `11000000`) é categoria **pai**; suas filhas são `Eating out` (`Restaurantes, bares e lanchonetes`) e `Food delivery` (`Delivery de alimentos`).
- A Pluggy carimba transação com a **categoria filha**, ex.: `category_pluggy = "Eating out"` → resolveCategory devolve **"Restaurantes, bares e lanchonetes"** (filha), nunca **"Alimentos e bebidas"** (pai).
- Quando o usuário cria orçamento na UI usando o seletor pai/filho, ele provavelmente seleciona o nome do **pai** (ex. "Alimentos e bebidas"), e o `budgetProgress` faz match exato `spentMap.get(b.categoryLabel)` que devolve `0` — mesmo havendo R$ X em "Restaurantes, bares e lanchonetes".
- Confirmação no banco: existe orçamento "Alimentos e bebidas" mas as transações estão como `Eating out`/`Food delivery`.

### Correção
Reformular o cálculo de orçamento para tratar o **rótulo da categoria pai como agregador**.

**`src/contexts/FinanceContext.tsx` — novo `budgetProgress`:**
1. Construir um índice `labelToParentLabel` a partir do catálogo `pluggy_categories` (descriptionTranslated da filha → descriptionTranslated do pai; pais mapeiam para si mesmos).
2. Ao computar `spent` do orçamento, somar todas as despesas do ciclo cuja categoria efetiva seja:
   - exatamente o `categoryLabel`, OU
   - filha cujo pai resolva para esse `categoryLabel`.
3. Manter o caminho atual de match exato como fallback (caso o usuário tenha criado orçamento numa categoria filha específica — ex.: só "Streaming de vídeo").

**Seletor do dialog "Novo orçamento" (`Categorizacao.tsx`):**
- Mostrar somente **categorias pai** + opção "todas as filhas". Hoje o `allCategoryLabels` mistura pai e filha, gerando confusão.
- Reescrever para `Select` agrupado: cabeçalho com pai (clicável → orçamento agregado) e itens filhas (clicáveis → orçamento da filha específica).
- Pré-selecionar pai por padrão.

**Bonus:** filtrar do somatório a categoria `Same person transfer` (pai `04000000`), já parcialmente filtrada por regex; agora fica explícito via parentId.

Resultado: orçamento "Alimentos e bebidas" passa a somar Eating out + Food delivery + qualquer outra filha, refletindo o gasto real.

---

## 3. Conexões → Remover conexão (não-operativo)

### Diagnóstico
Em `src/pages/app/Conexoes.tsx` o botão "Remover" (linhas 355-361) **não tem `onClick`** — está zerado. Nenhuma rota/edge function chamada.

### Correção
**Edge function nova: `supabase/functions/pluggy-delete-item/index.ts`** (verify_jwt = true).
Fluxo conforme documentação Pluggy (`DELETE /items/{id}`):
1. Valida JWT, recupera `user_id`.
2. Recebe `{ itemId }` no body (Zod-validated).
3. Confere posse: `pluggy_items` onde `pluggy_item_id = itemId AND user_id = auth.uid()`. Se não existe → 404.
4. Chama `DELETE https://api.pluggy.ai/items/{itemId}` (autenticado com `pluggy_client_id/secret`, igual às demais funções). Trata 404/410 da Pluggy como sucesso (já removido lá).
5. Em transação no DB (via service role + filtros `user_id`):
   - `DELETE FROM pluggy_transactions WHERE pluggy_item_id = $1 AND user_id = $2`
   - `DELETE FROM pluggy_bills WHERE pluggy_item_id = $1 AND user_id = $2`
   - `DELETE FROM pluggy_accounts WHERE pluggy_item_id = $1 AND user_id = $2`
   - `DELETE FROM pluggy_items WHERE pluggy_item_id = $1 AND user_id = $2`
   - **Não** apago `category_budgets` (são preferências do usuário, sobrevivem à reconexão).
6. Retorna `{ ok: true }`.

**`supabase/config.toml`:** registra `[functions.pluggy-delete-item] verify_jwt = true`.

**`src/pages/app/Conexoes.tsx`:**
- Estado `removingId`.
- Trocar o `<Button>Remover</Button>` por `AlertDialog` (shadcn) com confirmação ("Isso vai apagar contas, transações e faturas dessa conexão. Os limites de gastos definidos serão mantidos.").
- `onConfirm` invoca `pluggy-delete-item`, mostra toast de sucesso/erro, dispara `loadItems()` e o realtime do FinanceContext já atualiza Dashboard/Extrato/Faturas.

Resultado: botão funcional, dados do banco saem do painel imediatamente, possíveis reconexões futuras ficam limpas.

---

## Arquivos afetados

**Editados**
- `src/contexts/FinanceContext.tsx` — expor `pluggyAccountId` em accounts/transactions; novo cálculo de `budgetProgress` agregando filhas no pai.
- `src/pages/app/Faturas.tsx` — corrigir filtro de bills + filtro de transações por id Pluggy.
- `src/pages/app/Categorizacao.tsx` — seletor de categoria do orçamento agrupado por pai/filha; pré-seleção do pai.
- `src/pages/app/Conexoes.tsx` — botão Remover com `AlertDialog` + chamada da edge function.
- `supabase/config.toml` — bloco `[functions.pluggy-delete-item]`.

**Novos**
- `supabase/functions/pluggy-delete-item/index.ts` — desconexão na Pluggy + limpeza no banco.

---

## Fora do escopo (não vou tocar)
- IA de categorização (você pediu para não implementar).
- Reprocessar `category` (override manual) com base no novo agregador — orçamento usa só categoria efetiva, então isso não é necessário.

Confirma que posso aplicar.
