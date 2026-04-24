
# Plano — Evolução do produto: Categorização, Edição Inline e Ciclo Financeiro

## Contexto e premissas

- Mantém **visual atual**, **sidebar**, **rotas existentes** e **lógica das telas já construídas**.
- Mantém a base **mock** (sem Lovable Cloud nesta rodada). A trilha de segurança/LGPD com backend real continua pendente como trabalho separado, conforme combinado.
- Estado compartilhado entre telas via **React Context + `localStorage`** (persistência local) — assim Dashboard, Extrato, Categorização Pendente e Configurações leem/escrevem no mesmo lugar e refletem em tempo real.
- Categorias padronizadas (lista única, usada em todos os selects):
  `Moradia, Alimentação, Transporte, Compras, Assinaturas, Saúde, Lazer, Educação, Investimentos, Salário, Freelance, Transferências, Outros`.

---

## 1. Camada de dados e estado global

### 1.1 Evoluir `src/data/mockData.ts`
- Adicionar campos a cada `transaction`:
  - `pendingType?: "sem_categoria" | "transferencia_suspeita" | "recorrencia_detectada" | "inconsistencia"` (ausente = não pendente)
  - `confidence?: number` (0–1, para ordenar a fila)
  - `suggestedCategory?: string` (sugestão da "IA")
  - `recurrenceGroup?: string` (id do grupo de recorrência detectada)
- Marcar manualmente ~6–8 transações existentes com pendências variadas para popular a tela.
- Exportar constante `CATEGORIES: string[]` única, reutilizada no Extrato e na Categorização Pendente.

### 1.2 Novo `src/contexts/FinanceContext.tsx`
- Provider que expõe:
  - `transactions`, `updateCategory(id, category)`, `confirmTransfer(id)`, `markRecurring(id)`, `dismissPending(id)`
  - `cycleDay: number` (1–28), `setCycleDay(day)`
  - Selectors derivados (memoizados):
    - `pendingByType` → contagem por tipo
    - `pendingList` → lista filtrável e ordenada por prioridade (`inconsistencia` > `sem_categoria` > `transferencia_suspeita` > `recorrencia_detectada`, depois `confidence` asc, depois data desc)
    - `currentCycleRange` → `{ start: Date, end: Date }` calculado a partir de `cycleDay` (ex.: dia 8 → 09/mês-1 a 08/mês)
    - `previousCycleRange` → mesmo cálculo do ciclo anterior
    - `cycleTransactions` → transações dentro do ciclo atual
    - `cycleTotals` → `{ entradas, saidas, saldo }` do ciclo atual e do anterior (para comparativos %)
    - `expensesByCategoryCycle` → distribuição recalculada
- Persistência: `localStorage` para `transactions` (overrides de categoria + dismissals) e `cycleDay`. Hidratação no mount, gravação em `useEffect`.
- Wrapping: envolver `<AppLayout />` em `App.tsx` com `<FinanceProvider>` (escopo da área autenticada).

### 1.3 Novos helpers em `src/lib/format.ts` (ou novo `src/lib/cycle.ts`)
- `getCycleRange(cycleDay: number, ref: Date): { start, end }`
- `formatCycleLabel(range)` → ex.: "09 abr — 08 mai"
- `isWithinCycle(dateISO, range)`

---

## 2. Tela "Categorização Pendente" (nova)

### 2.1 Roteamento e sidebar
- Nova rota `/app/categorizacao` em `src/App.tsx`.
- Adicionar item na `AppSidebar.tsx` entre **Extrato Unificado** e **Conexões Open Finance**:
  - Ícone: `ListChecks` (lucide), título "Categorização Pendente".
  - Badge numérico ao lado do título com `pendingList.length` quando > 0 (estilo discreto, cor `accent`).

### 2.2 Página `src/pages/app/Categorizacao.tsx`
- Header: título + subtítulo explicando "Fila de revisão para manter seus dados financeiros limpos."
- **4 cards de resumo** no topo (grid 2x2 mobile, 4 colunas desktop):
  1. Sem categoria — ícone `HelpCircle`
  2. Transferências suspeitas — ícone `ArrowLeftRight`
  3. Recorrências detectadas — ícone `Repeat`
  4. Possíveis inconsistências — ícone `AlertTriangle`
  - Cada card mostra contagem + descrição curta + age como filtro (ativo destacado com `ring-2 ring-primary`).
- **Barra de filtros** abaixo dos cards: "Todos | Sem categoria | Transferências | Recorrências | Inconsistências".
- **Lista principal** (mesmo padrão visual do Extrato, Card com `divide-y`):
  - Cada linha mostra: ícone do tipo de pendência, descrição, conta, data, valor, e a **ação contextual** à direita.
  - Ações por tipo:
    - `sem_categoria` → `<Select>` de categorias (mesma lista do Extrato) + botão "Salvar".
    - `transferencia_suspeita` → botões "Confirmar transferência" / "Não é transferência" (segundo apenas remove da fila).
    - `recorrencia_detectada` → botões "Marcar como recorrente" / "Ignorar".
    - `inconsistencia` → `<Select>` para corrigir categoria sugerida vs atual + botão "Corrigir".
  - Quando ação é executada: chama método do `FinanceContext`, item desaparece da fila com `toast` de confirmação ("Categoria atualizada", etc.).
- Estado vazio: mensagem "Tudo em dia. Nenhuma pendência no momento." com ícone `CheckCircle2`.

---

## 3. Edição inline no Extrato Unificado

### 3.1 Refatorar `src/pages/app/Extrato.tsx`
- Substituir o `<Badge>` de categoria por um `<Select>` compacto (variante visual de badge — fundo `secondary/50`, altura ~28px) usando o componente `ui/select.tsx`.
- Opções vindas de `CATEGORIES`.
- Ao alterar:
  - `updateCategory(t.id, novaCategoria)` no contexto.
  - `toast` discreto: "Categoria atualizada".
  - Se a transação estava em `pendingList`, ela é automaticamente removida (a regra da fila ignora itens com `pendingType` resolvido).
- Filtro de categoria existente continua funcionando (lê `CATEGORIES`).
- Trocar o uso de `transactions` importado direto de `mockData` pelo hook `useFinance()` para garantir reatividade.

### 3.2 Propagação automática
- Como Dashboard, Categorização e Extrato consomem o **mesmo Context**, qualquer alteração re-renderiza tudo. Sem trabalho adicional além de garantir que cada tela use `useFinance()`.

---

## 4. Configuração de Ciclo Financeiro

### 4.1 Atualizar `src/pages/app/Configuracoes.tsx`
- Novo card "Ciclo financeiro" inserido **antes** do card "Preferências".
  - Título + descrição: "Defina o dia de fechamento do seu mês financeiro. Útil para alinhar com vencimento de cartão ou contas principais."
  - Campo: `<Input type="number" min={1} max={28}>` (limitar a 28 para evitar fevereiro problemático) **ou** `<Select>` com dias 1–28. Vou usar **Input numérico** com validação por ser mais ágil.
  - **Preview dinâmico** abaixo do campo: caixa destacada (`bg-secondary/40 border-border`) mostrando "Período atual: **09 abr — 08 mai**" recalculado em tempo real conforme o usuário digita.
  - Botão "Salvar" → grava em `FinanceContext` (e `localStorage`) + `toast` "Ciclo financeiro atualizado".
- Manter Switches existentes (não regredir o que já está lá).

### 4.2 Aplicar o ciclo no Dashboard
- `src/pages/app/Dashboard.tsx`:
  - Substituir números fixos dos KPIs ("Entradas no mês: 14.900", etc.) por cálculo a partir de `cycleTotals` do contexto.
  - Comparativo "% vs período anterior" calculado contra `previousCycleRange`.
  - Subtítulo do header passa a mostrar o range do ciclo: "Veja sua visão consolidada de **09 abr — 08 mai**."
  - Gráfico "Despesas por categoria" passa a usar `expensesByCategoryCycle` (recalculado).
  - Os gráficos `balanceEvolution` e `incomeVsExpense` continuam usando dados mensais agregados do mock (não há histórico granular suficiente para reagrupar 6 meses por ciclo customizado sem inventar dados — fica documentado como limitação do MVP mock; quando vier o backend real, esses recortes também respeitam o ciclo).
- "Movimentações recentes" passa a listar as últimas 6 do `cycleTransactions`.

### 4.3 Insights coerentes com o ciclo
- `aiInsights` no mock continua estático nesta rodada (são textos), mas vou adicionar um `cycleLabel` no header da seção: "Insights de **09 abr — 08 mai**" para reforçar o recorte. Geração dinâmica de insights baseada nas categorias editadas fica fora desse escopo (é feature de IA real, próxima fase).

---

## 5. Detalhes de UX e consistência visual

- Usar `sonner` (`toast`) já configurado em `App.tsx` para feedbacks.
- Reaproveitar tokens do design system (`bg-gradient-card`, `border-border`, `text-success`, `text-warning`, `text-accent`, `text-destructive`).
- Sem novos pacotes — só `lucide-react` (já instalado), `react-router-dom`, `recharts` e shadcn já presentes.
- Acessibilidade: `<Select>` inline no Extrato com `aria-label="Categoria da transação"`.

---

## 6. Arquivos afetados

**Criar**
- `src/contexts/FinanceContext.tsx`
- `src/pages/app/Categorizacao.tsx`
- `src/lib/cycle.ts`

**Editar**
- `src/data/mockData.ts` — adicionar campos de pendência + `CATEGORIES`
- `src/App.tsx` — nova rota `/app/categorizacao` + envolver `AppLayout` com `FinanceProvider`
- `src/components/AppSidebar.tsx` — novo item de menu com badge
- `src/pages/app/Extrato.tsx` — `<Select>` inline, consumo via `useFinance()`
- `src/pages/app/Dashboard.tsx` — KPIs e categorias a partir do ciclo
- `src/pages/app/Configuracoes.tsx` — card "Ciclo financeiro" com preview

**Sem alteração**
- Telas Contas, Conexões, Planos, Auth, Landing, Layout, todos os `ui/*`.

---

## 7. Fora deste escopo (para alinhar expectativa)

- Persistência em backend real / RLS / auditoria → trilha **Segurança LGPD** já combinada, segue separada.
- IA real para detectar pendências e gerar insights dinâmicos → próxima fase (precisa do backend + Lovable AI Gateway).
- Reagrupar gráficos de 6 meses por ciclo customizado (limitação do mock, comentada no código).

---

## Pronto para implementar

Se aprovar, eu já começo pela **camada de estado (Context + mockData)**, depois **Categorização Pendente**, em seguida **Extrato inline** e por último **Configurações + Dashboard com ciclo**, tudo em uma única passada.
