## 🎯 Objetivo

Transformar a aba **Categorias** numa visão mensal de consumos, no estilo da imagem de referência (Visor):

- Lista somente categorias **com gasto no mês selecionado** (zero-spend não aparece).
- Categoria pai expansível → mostra as filhas com gasto.
- Mostra valor, % do gasto total, e barra de progresso (vs. orçamento, se existir; vs. maior gasto, caso contrário).
- Navegação por mês (últimos 12 meses).
- Orçamentos podem ser definidos **tanto por pai quanto por filha**, com validação: a soma dos limites das filhas **nunca pode exceder** o limite do pai.

---

## 📊 Análise da situação atual

Estado hoje (`src/pages/app/Categorizacao.tsx` + `FinanceContext.tsx`):

- `expensesByCategoryCycle` agrega despesas **só do ciclo de cartão** atual e **somente por categoria PAI** (em `FinanceContext.tsx:393-415` toda transação é resolvida para o pai antes de virar `Transaction.category`).
- `category_budgets` aceita um único `category_label` por usuário, sem distinção pai/filha — não dá pra saber se um orçamento "Alimentação" é o pai ou uma filha homônima.
- A UI lista `budgetProgress` + `expensesByCategoryCycle` numa lista plana, sem expansão de filhas.
- Não há seletor de mês — usa o ciclo financeiro do usuário.

Gaps a fechar:
1. Precisamos preservar `categoryId` e `categoryParentId` na Transaction para conseguir agregar por **pai E filha**.
2. `category_budgets` precisa de `scope` ('parent' | 'child') + opcionalmente `parent_category_label` pra validar a regra hierárquica.
3. UI nova: agregação por mês civil (não por ciclo de cartão), listagem hierárquica colapsável.

---

## 🗂️ Mudanças propostas

### 1. Banco de dados (migration nova)

Adicionar colunas em `category_budgets` para suportar a hierarquia:

```sql
ALTER TABLE public.category_budgets
  ADD COLUMN scope text NOT NULL DEFAULT 'parent'
    CHECK (scope IN ('parent','child')),
  ADD COLUMN parent_category_label text NULL;
-- 'parent_category_label' só é preenchido quando scope='child'.
-- A unicidade continua (user_id, category_label).
```

Sem CHECK constraint cross-row — a validação **soma_filhas ≤ pai** roda no client (no momento do salvamento do orçamento) e no edge ao escrever (defesa em profundidade não é necessária aqui por enquanto, mas pode entrar num próximo passo).

### 2. Tipo `Transaction` (em `src/data/mockData.ts`)

Acrescentar campos opcionais:
- `categoryId?: string` — id Pluggy da categoria resolvida
- `categoryParentId?: string | null` — id do pai
- `categoryChildLabel?: string` — rótulo PT-BR da categoria filha original (antes de resolver pra pai)

### 3. `FinanceContext.tsx`

- Quando montar cada `Transaction`, **manter o pai como `category` (não muda — preserva extrato)**, mas também guardar `categoryChildLabel` (descrição traduzida da categoria original) e `categoryId/categoryParentId`.
- Adicionar selector novo `expensesByMonth(monthKey)` que agrega por (pai → filhas) num único mês civil. Estrutura retornada:
  ```ts
  type CategoryMonthlyAgg = {
    parentLabel: string;
    parentId: string | null;
    spent: number;
    pctOfTotal: number;
    children: { label: string; spent: number; pctOfParent: number }[];
  };
  ```
  - Despesas sem categoria filha conhecida → bucket "Outros (categoria pai)" dentro do próprio pai.
  - Filtra transferências e pagamento de cartão (mesma regra atual).
- Atualizar `CategoryBudget` para incluir `scope` e `parentCategoryLabel`.
- `upsertBudget(label, limit, threshold, scope, parentLabel?)` — assinatura nova.
- Novo derivado `budgetValidation(parentLabel, attemptedChildLimit, currentChildId?)` que retorna se o limite cabe dentro do pai.

### 4. Página `Categorizacao.tsx` (refatoração)

**Layout da aba "Por categoria" (nova, default):**

```
┌─────────────────────────────────────────────┐
│ [< abr 26 >]                       Filtros │
├─────────────────────────────────────────────┤
│ Total gasto no mês: R$ 2.345,67   12 categs│
├─────────────────────────────────────────────┤
│ ▸ 🍔 Alimentação      R$ 540  23%  ▓▓▓▓░░ │  ← clique expande
│   ↳ Restaurantes      R$ 320  59%  ▓▓▓▓▓░ │
│   ↳ Delivery          R$ 220  41%  ▓▓▓░░░ │
│ ▸ 🛒 Compras          R$ 410  17%  ▓▓▓░░░ │
│ ▸ 💡 Moradia          R$ 380  16%  ▓▓░░░░ │
│ ...                                         │
└─────────────────────────────────────────────┘
```

- Componente novo `CategoryMonthRow` (colapsável, usa `<Collapsible>` do projeto).
- Mostra mini-badge "Limite: R$ X" + barra colorida (ok/alert/over) quando há orçamento.
- Botão "Definir limite" inline em cada linha (pai ou filha).
- Mês default = mês civil atual; usa `MonthSelector` reaproveitado (mesma UX do Extrato).

**Aba "Pendentes"** continua igual.

### 5. Diálogo de orçamento (`Categorizacao.tsx`)

Adicionar:
- Toggle visual `[Pai] [Filha]` quando o usuário cria um orçamento novo.
- Se "Filha", aparece um Select extra "Categoria pai" (preenchido a partir do catálogo).
- Validação ao salvar:
  - **Filha:** se já existe orçamento do pai → `limite_filha + soma_outras_filhas ≤ limite_pai`. Se não existe orçamento do pai → permite, mas mostra dica "Defina também um teto para a categoria pai".
  - **Pai:** se já existem filhas com orçamento → `novo_limite_pai ≥ soma_filhas`. Se violar, mostra erro: "O limite da categoria pai precisa ser ≥ R$ X (soma das filhas)".
- Mensagens de erro inline (não toast) abaixo do input de valor.

### 6. Componentes novos

- `src/components/categorias/CategoryMonthRow.tsx` — linha colapsável.
- `src/components/categorias/CategoryMonthSummary.tsx` — header com total e contador.
- `src/components/categorias/BudgetDialog.tsx` — extraído do `Categorizacao.tsx` para acomodar a nova lógica de validação hierárquica.

### 7. Realtime / persistência

`category_budgets` já está na publicação realtime — só refletir as novas colunas no select do contexto.

---

## ✅ Critérios de aceite

1. Página Categorias abre no mês atual, lista só categorias com gasto > 0, ordenadas por valor desc.
2. Clicar numa categoria pai expande filhas com gasto > 0; meses sem gasto naquela filha não aparecem.
3. Quando uma transação nova chega com categoria inédita no mês, ela aparece automaticamente (já garantido pelo realtime + agregação dinâmica).
4. Posso definir orçamento por pai e por filha. Tentativa de criar filha cuja soma exceda o pai é bloqueada com mensagem clara.
5. Tentativa de reduzir o pai abaixo da soma das filhas é bloqueada com mensagem clara, indicando o mínimo exigido.
6. Navegação por mês funciona (últimos 12 meses) e o seletor mantém o estado ao trocar de aba.

---

## 🚫 Fora de escopo

- Reabrir a aba "Pendentes" — fica como está.
- Não vou criar a categoria "Recorrentes" agora (preferência registrada anteriormente).
- Não estou mudando o ciclo financeiro do usuário; a página Categorias usa **mês civil** (a regra de "ciclo de cartão" continua valendo só pra Faturas).