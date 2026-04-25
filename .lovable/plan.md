
## Diagnóstico (baseado em dados reais já no banco)

Inspecionando `pluggy_transactions` e `pluggy_accounts` do seu usuário, encontrei a raiz dos problemas:

| Sintoma na UI | Causa real |
|---|---|
| Openai aparece como **R$ 51,52** (valor da fatura), mas extrato mostra **−$10,00 USD** sem conversão consistente | Salvamos `amount = -10.00` (USD) e ignoramos `amountInAccountCurrency = 51.52` (BRL). |
| Cartão "gold" mostra `-R$ 4.106,91` mas sem **limite (R$ 5.150)** nem **% usado (79.7%)** | Não persistimos `creditData.creditLimit`, `availableCreditLimit`, `balanceDueDate`, `balanceCloseDate`, `minimumPayment`. |
| "Faturas do mês" não existe | Endpoint `/bills` da Pluggy nunca foi consumido. |
| Todas as transações caem em "Sem categoria" | A Pluggy já entrega `category` ("Digital services", "Tax on financial operations", "Transfer - PIX"…) mas só lemos quando o usuário define manualmente. |
| Lista de categorias do select é hardcoded ("Moradia / Alimentação / …") | Deveria vir do endpoint oficial `/categories` da Pluggy (árvore com `id`, `description`, `descriptionTranslated`, `parentId`). |
| Pagamentos de fatura aparecem como entrada/saída duplicada | Sinal do `amount` em cartão é **invertido manualmente** no `pluggy-sync-data`, mas a Pluggy já entrega o sinal correto (positivo = gasto, negativo = pagamento) — estamos duplicando lógica. |

## O que vou fazer (seguindo estritamente a doc oficial)

### 1. Banco — novas colunas e tabelas

**Migration nova:**

- `pluggy_accounts` ganha: `credit_limit`, `available_credit_limit`, `balance_due_date`, `balance_close_date`, `minimum_payment`, `card_brand`, `card_level`, `card_number_last4`, `bank_overdraft_limit`, `bank_overdraft_used`, `automatically_invested_balance`, `raw_payload jsonb`. Tudo nullable.
- `pluggy_transactions` ganha: `amount_in_account_currency numeric`, `account_currency text`, `status text` (PENDING|POSTED), `category_id text` (id Pluggy), `category_parent_id text`, `installment_number int`, `total_installments int`, `merchant_name text`, `operation_type text`. RLS já existente cobre.
- Nova tabela `pluggy_categories` (catálogo global, **sem `user_id`**, leitura pública para `authenticated`): `id text PK`, `description text`, `description_translated text`, `parent_id text`, `parent_description text`. Populada por uma sincronização leve do `/categories`.
- Nova tabela `pluggy_bills` para faturas de cartão: `id uuid`, `user_id`, `pluggy_bill_id text unique`, `pluggy_account_id text`, `due_date date`, `total_amount numeric`, `total_amount_currency text`, `minimum_payment_amount numeric`, `allows_installments bool`, `paid bool`, `raw_payload jsonb`. RLS `auth.uid() = user_id`.

### 2. Edge Function `pluggy-sync-data` — alinhar 100% com a doc

- **Accounts**: persistir `creditData.*` em colunas novas. Para `BANK`, persistir `bankData.overdraftContractedLimit`, `overdraftUsedLimit`, `automaticallyInvestedBalance`. **Remover a inversão manual de balance** para cartão: a Pluggy já documenta que o `balance` de `CREDIT` representa a fatura aberta (dívida). Vamos guardar como vem (positivo) e tratar o sinal **na camada de leitura** baseado em `type === 'CREDIT'`. Isso evita corromper o dado bruto.
- **Transactions**: salvar `amount` **exatamente como a Pluggy entrega** (com sinal). Doc: para cartão, positivo = gasto, negativo = pagamento. Para conta corrente, `type DEBIT/CREDIT` + sinal já vêm consistentes via Pluggy. Persistir também `amountInAccountCurrency`, `currencyCode` da transação, `status`, `categoryId`, `creditCardMetadata.installmentNumber/totalInstallments`, `merchant.name`, `operationType`.
- **Categories**: ao primeiro sync (ou via função dedicada `pluggy-sync-categories`), buscar `/categories` e popular `pluggy_categories`. Não depende de usuário (catálogo global).
- **Bills**: para cada conta `CREDIT_CARD`, buscar `/bills?accountId=...` e gravar em `pluggy_bills`. Tratar paginação igual a transactions.

### 3. Frontend — usar dados da Pluggy de verdade

- **`FinanceContext`**:
  - Carregar `pluggy_categories` (uma vez por sessão) e expor uma árvore `categoriesTree`. O select passa a ser populado por `descriptionTranslated`, agrupado por categoria pai.
  - `category` exibido = `category` manual do usuário (override) **OU** `category_pluggy` da Pluggy. Fica "Sem categoria" só quando ambos forem nulos. Isso resolve o problema de "tudo cai em pendência".
  - `pendingList` filtra transações onde **nem o usuário nem a Pluggy** atribuíram categoria.
  - Na conversão BRL: se `amountInAccountCurrency` existir e a `currency` da transação ≠ `currency` da conta, usar `amountInAccountCurrency` (já em BRL) para somatórios, mantendo o valor original como referência.
  - `totalBalance`: somar contas `BANK.balance` − `CREDIT.balance` (cartão é dívida). `availableCreditLimit` exposto separadamente para a UI.
  - Filtro opcional para excluir `status = 'PENDING'` no consolidado.

- **Tela `Contas`**: dois grupos visuais — **Cartões de Crédito** (com barra de uso `balance / creditLimit`, % usado, limite total, vencimento `balanceDueDate`) e **Contas Bancárias** (saldo atual). Igual ao screenshot do Visor que você mandou.

- **Tela `Extrato`**:
  - Mostrar valor em BRL (`amountInAccountCurrency` quando estrangeiro), com o valor original abaixo em cinza (`$10.00 USD`), igual ao layout do Visor.
  - Badge da categoria nativa Pluggy (em PT-BR, via `descriptionTranslated`).
  - Select de categoria carregado do catálogo Pluggy real (agrupado por pai).
  - Quando usuário troca categoria → grava em `pluggy_transactions.category` e (futuramente) cria `Category Rule` na Pluggy via endpoint dedicado — fica como TODO comentado nesta etapa, sem implementar.

- **Tela `Categorização`**: continua filtrando só "Sem categoria" como você pediu — agora com a regra correta (nem usuário nem Pluggy categorizou). Tendência: lista vai esvaziar drasticamente.

- **Tela `Dashboard`**: gráfico "Principais categorias" passa a usar `category_pluggy` traduzida quando não houver override — então finalmente terá dados reais.

### 4. Limpeza
- Remover `CATEGORIES` hardcoded em `src/data/mockData.ts` (mantém só `Transaction` interface e `CATEGORY_COLORS` como fallback de cor).
- Remover a inversão manual de `balance` de cartão em `pluggy-sync-data` (única fonte da verdade: doc Pluggy).

### 5. Após deploy
Você abre **Conexões → Sincronizar**. A função vai reprocessar contas, transações, categorias e faturas. As telas refletem dados corretos imediatamente via Realtime.

## O que NÃO vou fazer agora (e por quê)
- IA de categorização própria — você pediu para não implementar.
- Criar Category Rules na Pluggy automaticamente — escopo separado, fica como próxima iteração.
- Tela de faturas detalhada — o backend grava `pluggy_bills`, mas a UI dedicada (`/app/faturas`) fica para iteração seguinte para não inflar este PR. O Dashboard já vai mostrar resumo de fatura aberta usando os dados de `creditData`.
