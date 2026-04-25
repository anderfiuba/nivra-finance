## Diagnóstico (com base na doc oficial Pluggy + dados reais no DB)

Inspecionei `pluggy_transactions`, `pluggy_categories` e a documentação oficial (`/reference/transactions`). Os problemas que você está vendo são lógica de leitura no frontend, não dados perdidos:

1. **Tudo aparece como entrada** — `FinanceContext.tsx` calcula `isEntrada = signedAmount >= 0` baseado em inverter o sinal só pra cartão. Mas a doc da Pluggy é explícita: o **campo `type`** (`DEBIT` = outflow, `CREDIT` = inflow) é a fonte de verdade, válido tanto para conta bancária quanto para cartão. O `amount` por si só tem semântica diferente em cada tipo de conta. Os dados no DB já vêm com `type` correto (`DEBIT` para gastos, `CREDIT` para entrada/pagamento de fatura).

2. **Categorias todas vazias** — A Pluggy já entrega categoria nativa em `category_pluggy` (ex: `"Transfers"`, `"Digital services"`, `"Electronics"`). O FinanceContext só considera `category` (override manual) e ignora `category_pluggy` na hora de exibir; ele usa só pra decidir "tem ou não". Resultado: mesmo com categoria da Pluggy preenchida, a UI mostra "Sem categoria".

3. **Categorias em inglês** — O catálogo `pluggy_categories` (130 linhas) tem `description_translated` em PT-BR (`"Transferências"`, `"Serviços digitais"`, `"Eletrônicos"`), mas o frontend exibe `category_pluggy` cru (em inglês).

4. **Pendências de categorização** — Como a regra atual só considera `pendingType: "sem_categoria"` quando AMBOS estão vazios, isso já está alinhado com o que você quer. Após o fix, transações com categoria nativa Pluggy saem da fila automaticamente.

## Plano de Implementação

### 1. `src/contexts/FinanceContext.tsx` — adotar regras oficiais Pluggy

**Sinal (entrada vs saída):**
- Substituir a heurística de inversão por cartão pelo campo oficial `type`:
  - `t.type === "CREDIT"` → `entrada`
  - `t.type === "DEBIT"` → `saida`
- Fallback (raros casos sem `type`): usar `amount > 0` para conta BANK; cartão CREDIT inverte.
- Adicionar `type` ao `select()` (já está, confirmar).

**Valor exibido (BRL):**
- Para somatórios e exibição em BRL, priorizar `amount_in_account_currency` quando `currency !== account_currency`, conforme doc (`amountInAccountCurrency`). Senão, usar `amount`.
- O valor armazenado em `value: Math.abs(...)` continua sendo o módulo, e `type` controla o sinal visual.

**Categoria efetiva (cruzamento com catálogo PT-BR):**
- Construir um Map `categoryByName: Map<string, PluggyCategoryNode>` indexado por `description` (inglês, como vem em `category_pluggy`) e por `id` (para `category_id`).
- Categoria efetiva da transação:
  1. Se `t.category` (override manual) preenchido → usa.
  2. Senão se `t.category_id` ou `t.category_pluggy` resolvem no catálogo → usa `description_translated` (PT-BR).
  3. Senão → `""` e marca `pendingType: "sem_categoria"`.
- Resultado: 95% das transações ficam categorizadas automaticamente em PT-BR; só transações realmente sem categoria nativa vão pra fila.

**Exclusão de transferências do gráfico de despesas:**
- Já tem regex; trocar pra checar contra o `parent_description` (`"Transferências"`) do catálogo, não substring solta.

### 2. `src/pages/app/Extrato.tsx` — Select de categoria correto

- O `Select` atual usa `value={t.category || ""}` e options com `value={it.label}`. Quando a categoria efetiva vem do catálogo Pluggy (não do override), o select fica vazio mesmo a transação tendo categoria.
- Trocar pra usar a **categoria efetiva calculada** (já vem resolvida do contexto). Quando o usuário seleciona uma categoria do dropdown, gravamos no `category` (override) — comportamento que já existe.
- Garantir que `groupedCategories` use `parent_description` traduzida quando disponível (a Pluggy entrega `parentDescription` em inglês; precisamos buscar a tradução pelo `parent_id` no próprio catálogo).

### 3. `src/pages/app/Categorizacao.tsx`
- Sem mudança de regra (já filtra `sem_categoria`). Após o fix do contexto, a lista vai diminuir drasticamente porque transações com `category_pluggy` saem da fila.
- Aplicar a mesma melhoria de `groupedCategories` com parent traduzido.

### 4. `supabase/functions/pluggy-sync-data/index.ts` — sem mudanças funcionais
- O backend já está correto e fiel à doc: persiste `amount` cru, `type`, `category_pluggy`, `category_id`, `amount_in_account_currency`. Não toca.

### 5. Não mexer em
- Schema do banco (já tem todas as colunas necessárias).
- `pluggy-sync-categories` (catálogo já populado, 130 linhas).
- Lógica de saldo consolidado (já está correta: cartão entra como dívida).

## Resultado esperado

Após o deploy, **sem precisar re-sincronizar**:
- Extrato mostra ↓ vermelho para gastos (DEBIT) e ↑ verde para entradas (CREDIT), tanto em conta quanto em cartão.
- Categorias aparecem em PT-BR vindas da Pluggy ("Transferências", "Serviços digitais", "Eletrônicos", "Impostos sobre operações financeiras").
- Fila de "Categorização Pendente" cai pra perto de zero — só transações sem categoria nativa.
- Compras internacionais (USD) somam pelo valor convertido em BRL (`amountInAccountCurrency`) no dashboard, mas exibem o original ao lado.
- Override manual continua funcionando: usuário pode trocar a categoria sugerida pela Pluggy a qualquer momento.