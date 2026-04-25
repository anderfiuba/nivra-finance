## 1. Bug de exibição no Extrato (sinal +/−)

**Problema:** em `src/pages/app/Extrato.tsx` (linha 178) o template renderiza `{t.value > 0 ? "+" : ""}`. Como em `FinanceContext.tsx` o `value` é armazenado como `Math.abs(amountConverted)`, **saídas também aparecem com `+`**.

**Correção:**
- Renderizar prefixo conforme `t.type`: `+` para `entrada`, `−` para `saida`.
- Aplicar a cor `text-destructive` (vermelho) em saídas, `text-success` (verde) em entradas — alinhado ao já praticado em `Categorizacao.tsx`.
- Mesmo ajuste em qualquer outro local que use `t.value > 0 ? "+" : ""` (Dashboard "Movimentações recentes", se existir).

---

## 2. Sidebar — Renomear "Categorização Pendente" → "Categorias"

**Arquivo:** `src/components/AppSidebar.tsx`
- Alterar título do item de menu de **"Categorização Pendente"** para **"Categorias"**.
- Manter rota `/app/categorizacao` (sem quebrar bookmarks); o badge numérico continua exibindo a contagem de pendências (`sem_categoria`).
- Ícone: trocar `ListChecks` por `Tags` (Lucide) — mais condizente com gestão de categorias.

---

## 3. Nova funcionalidade: Orçamentos mensais por categoria

### Banco de dados (nova migration)

Tabela **`category_budgets`**:
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | RLS por `auth.uid()` |
| `category_label` | text NOT NULL | Rótulo PT-BR (ex.: "Mercado") — mesma string usada em `transactions.category` (efetiva) |
| `monthly_limit` | numeric NOT NULL | Em BRL |
| `alert_threshold` | numeric NOT NULL DEFAULT 0.8 | 0–1, dispara aviso (ex.: 80%) |
| `created_at`, `updated_at` | timestamptz | trigger `update_updated_at_column` |

- **Índice único** `(user_id, category_label)`.
- **RLS:** 4 políticas (SELECT/INSERT/UPDATE/DELETE) com `auth.uid() = user_id` — mesmo padrão das demais tabelas Pluggy.

### UI — Página `Categorias` (refator de `src/pages/app/Categorizacao.tsx`)

Estrutura em **abas (Tabs do shadcn)**:

**Aba 1 — "Pendentes"** (mantém UX atual)
- Lista somente `pendingType === "sem_categoria"`.
- Já é o comportamento atual; nenhuma mudança funcional.

**Aba 2 — "Orçamentos"** (NOVA)
- Cabeçalho com referência ao ciclo atual (`currentCycleLabel` do FinanceContext).
- **Lista de categorias gastas no ciclo** (derivada de `expensesByCategoryCycle`) + categorias com orçamento definido (mesmo sem gasto). Cada linha:
  - Nome da categoria + cor.
  - **Barra de progresso** (`<Progress />` shadcn) com `gasto / limite`.
  - Texto: `R$ 320 de R$ 800 (40%)`.
  - **Estado visual:**
    - `< alert_threshold` → barra primária (azul).
    - `≥ alert_threshold && < 100%` → barra `warning` (amarelo) + ícone `AlertTriangle` + tooltip "Próximo do limite".
    - `≥ 100%` → barra `destructive` (vermelho) + badge "Estourou".
  - Botão **"Editar"** abre `Dialog` com inputs: limite mensal (R$) e threshold (slider 50–95%).
  - Categorias **sem orçamento** mostram apenas o gasto + botão "Definir limite".
- Botão "Adicionar orçamento" → `Dialog` com `Select` populado pelas categorias do catálogo Pluggy (mesma estrutura agrupada já usada no Extrato).

**Aba 3 — "Catálogo"** (opcional, valor baixo) — **NÃO implementar agora**, anotado como possível extensão futura.

### Cálculo dos avisos (no `FinanceContext`)
- Adicionar selectors:
  - `categoryBudgets: CategoryBudget[]` carregada via `supabase.from("category_budgets").select(...)`.
  - `budgetProgress: { categoryLabel; spent; limit; threshold; status: "ok"|"alert"|"over" }[]`, derivado de `expensesByCategoryCycle` × `categoryBudgets`.
  - `budgetAlerts: number` — contagem de orçamentos em `alert`/`over` para badge na sidebar (item "Categorias" passa a contar **pendências + alertas**, ou seguimos só pendências — decisão padrão: **pendências apenas** para evitar ruído; alertas ficam visíveis dentro da página).
- Mutações: `upsertBudget(label, limit, threshold)`, `deleteBudget(label)` — ambas persistem em `category_budgets`.
- Realtime: assinar `category_budgets` (mesmo padrão das demais tabelas).

### Avisos
- **Toast (Sonner)** já no `useEffect` quando `budgetProgress` muda de status para `alert` ou `over` durante a sessão (com guard `useRef` para não disparar duplicado).
- Exemplo: `toast.warning("Você atingiu 85% do orçamento de Mercado.")`.

---

## 4. Nova aba: Faturas (`/app/faturas`)

### Dados — todos vêm da Pluggy (já persistidos)
- **`pluggy_bills`** — já existe. Contém `due_date`, `total_amount`, `minimum_payment_amount`, `paid`, `pluggy_account_id`. **Sem mock.**
- **`pluggy_transactions`** com `pluggy_account_id` da conta `CREDIT` + `installment_number` / `total_installments` para distinguir parcelado de avulso.
- **`pluggy_accounts`** (`type = CREDIT`) para nome do cartão, brand, last4, `available_credit_limit`, `credit_limit`, `balance_due_date`.

> Observação importante: a tabela `pluggy_bills` **já é populada** pela função `pluggy-sync-data` (linhas 391–413). Se durante testes ela vier vazia para algum conector, é porque a Pluggy não expõe `/bills` para todos — nesse caso, derivamos a fatura agrupando transações `CREDIT` por mês de competência (fallback descrito abaixo).

### Roteamento
- Adicionar rota `/app/faturas` em `src/App.tsx`.
- Adicionar item `{ title: "Faturas", url: "/app/faturas", icon: CreditCard }` em `AppSidebar.tsx`, posicionado logo após "Contas".

### Página `src/pages/app/Faturas.tsx`

**Cabeçalho:** título + dropdown de seleção de cartão (popular com contas `type = CREDIT`).

**Cards-resumo (topo):**
- Total da fatura aberta atual (somatório `pluggy_bills` mais recente do cartão selecionado, ou `account.balance` se sem bill).
- Limite disponível / total (`availableCreditLimit / creditLimit`) com barra.
- Vencimento (`balanceDueDate`) com badge colorido por proximidade (verde > 7d, amarelo 3–7d, vermelho ≤ 3d ou vencida).

**Tabela mensal (mês a mês):**
- Lista de bills ordenadas por `due_date` desc.
- Cada linha: período/competência, valor total, mínimo, vencimento, status (Pago / Aberta / Vencida — derivado de `paid` + `due_date < hoje`).
- Click em uma fatura abre **detalhamento** (acordeão ou rota `/app/faturas/:billId`):

**Detalhamento da fatura:**
- Duas seções (Tabs internas):
  - **"Compras avulsas"** — transações da fatura sem `installment_number` ou com `total_installments == 1`.
  - **"Parcelas"** — transações com `total_installments > 1`. Mostra `2/10`, valor da parcela, e merchant.
- Cada item: descrição, merchant, categoria efetiva (mesma resolução já feita no Extrato), valor (sinal correto: gasto = vermelho).
- **Filtro de fatura ↔ transações:** por padrão a Pluggy não associa `bill_id` à transação. Estratégia: agrupar transações da conta CREDIT pela janela `[balance_close_date_anterior, balance_close_date_atual]`. Se não houver datas, fallback para mês de competência (`due_date.month - 1`).

**Sem dados mock.** Todas as somas vêm de `pluggy_transactions` + `pluggy_bills`. Se o cartão não tiver dados ainda, exibir empty state "Sincronize esta conta para visualizar faturas".

### FinanceContext — exposição de dados
- Adicionar:
  - `bills: FinanceBill[]` carregado de `pluggy_bills`.
  - Selector `getBillsByAccount(accountId)`.
  - Selector `getTransactionsForBill(bill)` que aplica a janela de datas descrita acima.
- Realtime: assinar `pluggy_bills`.

---

## 5. Garantia de "dados reais" (sem mocks)

- Todas as novas leituras (`bills`, `category_budgets`, transações de cartão) usam `supabase.from(...)` — zero referência ao `mockData`.
- A função `pluggy-sync-data` já persiste `bills` e accounts CREDIT com `creditData` completo. Não requer alteração.
- Empty states explícitos em cada nova tela quando não houver dados, com CTA "Ir para Conexões → Sincronizar".

---

## 6. Resumo de arquivos

**Novos**
- `supabase/migrations/<timestamp>_category_budgets.sql` — tabela + RLS + trigger updated_at.
- `src/pages/app/Faturas.tsx`
- (opcional) `src/components/budgets/BudgetDialog.tsx`, `src/components/faturas/BillDetail.tsx` para manter componentes enxutos.

**Editados**
- `src/pages/app/Extrato.tsx` — corrigir sinal `+/−` e cor de saídas.
- `src/components/AppSidebar.tsx` — renomear item, novo ícone, nova entrada "Faturas".
- `src/App.tsx` — registrar rota `/app/faturas`.
- `src/pages/app/Categorizacao.tsx` — refator para Tabs (Pendentes + Orçamentos), título "Categorias".
- `src/contexts/FinanceContext.tsx` — adicionar `bills`, `categoryBudgets`, `budgetProgress`, mutações e realtime das novas tabelas.

---

## 7. O que NÃO está incluído (alinhamento de escopo)

- Categorização automática por IA (excluído por pedido seu anterior).
- Edição em massa de transações.
- Relatórios PDF de fatura.

Confirme para eu aplicar as mudanças.