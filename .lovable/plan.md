
## Objetivo
Resolver a dor "preciso saber em 2 segundos, antes de comprar, quanto ainda posso gastar nesta categoria este mês". Sem abrir dashboard, sem rolar listas. Pensada **primeiro pra mobile** (uso real: na fila do café), funciona elegante no desktop.

## Princípios
1. **Não poluir**: nenhuma página nova no menu lateral cheio. Vira a **rota raiz `/app`** quando aberto no celular (substitui o Dashboard nessa largura). No desktop continua mostrando o Dashboard atual; a Pocket View aparece como um **card compacto no topo do Dashboard** ("Disponível hoje") com link "Ver tudo" → leva pra rota dedicada `/app/disponivel`.
2. **Zero clique pra ver**: ao abrir o app no celular, a primeira coisa visível é o número que importa: **"R$ X disponível este mês"** + lista enxuta de categorias com barra.
3. **Reaproveita o que já existe**: `categoryBudgets`, `monthlyCategoryAggregates`, `expensesByCategoryMonth`, `categories` — tudo já no `FinanceContext`. Sem mudança de schema, sem migration.

## O que entrega

### 1. Componente `<PocketView />` (novo arquivo `src/pages/app/Disponivel.tsx`)
Layout (mobile-first, uma coluna):

```
┌─────────────────────────────┐
│ Abril • dia 26 de 30        │  ← header minúsculo
│                             │
│ R$ 2.340,18                 │  ← número GRANDE (text-4xl)
│ disponível este mês         │
│ ▓▓▓▓▓▓▓▓░░ 67% do orçamento │  ← barra agregada
│                             │
├─ Por categoria ─────────────┤
│ 🍔 Alimentação              │
│ R$ 420 de R$ 800            │
│ ▓▓▓▓▓░░░░░ resta R$ 380     │
│                             │
│ 🎮 Lazer       ⚠            │  ← warning quando > threshold
│ R$ 1.700 de R$ 2.000        │
│ ▓▓▓▓▓▓▓▓░░ resta R$ 300     │
│                             │
│ 🚗 Transporte               │
│ Sem orçamento • gastou R$ 90│  ← discreto, sem barra
│   [+ definir limite]        │  ← inline, abre dialog do Categorizacao
└─────────────────────────────┘
```

**Regras de ordenação** (do mais urgente pro menos):
1. Categorias com `progresso ≥ alertThreshold` (estouro iminente) — vermelho/âmbar no topo.
2. Categorias com orçamento, ordenadas por `progresso` decrescente.
3. Categorias sem orçamento mas com gasto no mês (CTA "definir limite").
4. (não mostra categorias sem orçamento e sem gasto — evita poluição).

**Cálculo** (puro, baseado em selectors existentes):
```ts
const totalBudget = categoryBudgets.reduce((s, b) => s + b.monthlyLimit, 0);
const totalSpent  = categoryBudgets.reduce((s, b) => s + (progress[b.id]?.spent ?? 0), 0);
const available   = totalBudget - totalSpent;          // pode ser negativo
const dayOfMonth  = new Date().getDate();
const totalDays   = daysInCurrentMonth();
```
(Aproveito `budgetProgress` que já existe — só preciso conferir nome exato no contexto.)

### 2. Roteamento adaptativo
- Rota nova: `/app/disponivel` (a Pocket View dedicada).
- No `/app` (Dashboard), adiciono **no topo** um `<PocketSummaryCard />` compacto: número grande + 3 categorias mais críticas + botão "Ver todas". Em telas `< md` esse card ocupa quase a tela toda (parece a pocket view). Em `md+` ele fica num formato horizontal de 1/3 da largura do header.
- **Não adiciono item no sidebar** (manter limpo). O acesso é: Dashboard → card → "Ver todas". O card já é o atalho principal.

### 3. Ações inline na Pocket View
Cada card de categoria tem um botão minúsculo "⋯" que abre um sheet (`@/components/ui/sheet` lateral em desktop, bottom sheet em mobile via `vaul` que já temos) com:
- Editar limite (reaproveita lógica de `upsertBudget` do `FinanceContext`).
- Ver últimas 5 transações dessa categoria no mês (deriva de `monthTransactions` filtrando por `category`).
- Link "Ver tudo no extrato" → `/app/extrato?category=X` (vou aceitar o query param em `Extrato.tsx`).

Isso evita pingue-pongue entre páginas. Conferir antes de gastar e ajustar o limite, tudo na mesma tela.

### 4. Estado vazio (sem nenhum orçamento)
Mostra:
- Número grande sumiço; em vez disso: "Defina um limite mensal pra começar."
- Botão grande "Definir primeiro orçamento" → abre o mesmo dialog de Categorização.
- Lista as 3 categorias **mais gastas no mês corrente** como sugestão clicável ("Você gastou R$ X em Alimentação — definir limite?").

### 5. Polimento mobile (responsividade)
- `safe-area-inset` no padding inferior pra não esconder atrás do home indicator do iPhone.
- Tipografia escala: `text-4xl` mobile → `text-5xl md:text-6xl` desktop pro número principal.
- Cards de categoria: `min-h-[88px]` (toque confortável), `tap-highlight-color: transparent`.
- Pull-to-refresh nativo do browser funciona naturalmente (não interceptamos).
- Cores semânticas: verde quando `progresso < 60%`, âmbar `60-90%`, vermelho `> 90%`. Usa tokens `--success`, `--warning`, `--destructive` já definidos no `index.css` (sem hardcode).

### 6. Modo claro (já é default no app)
Tudo via tokens semânticos do design system — funciona claro e escuro sem ajuste extra.

## Arquivos
**Novos**
- `src/pages/app/Disponivel.tsx` — página dedicada (rota `/app/disponivel`).
- `src/components/dashboard/PocketSummaryCard.tsx` — versão compacta pro Dashboard.
- `src/components/disponivel/CategoryBudgetCard.tsx` — card individual de categoria.
- `src/components/disponivel/CategorySheet.tsx` — bottom sheet com edit + últimas 5 txs.

**Editados**
- `src/App.tsx` — registrar rota `/app/disponivel`.
- `src/pages/app/Dashboard.tsx` — inserir `<PocketSummaryCard />` no topo (acima da grid de KPIs).
- `src/pages/app/Extrato.tsx` — aceitar `?category=` no query param e pré-filtrar.

**Não toco**
- `FinanceContext.tsx` (selectors já existem; se faltar `budgetProgress` exposto, exponho — verifico no momento da edição).
- Sidebar (não adiciono item — atalho é via card no Dashboard).
- Schema do banco (zero migration).

## Fora de escopo (próximas rodadas)
- Lançamento manual rápido (FAB +).
- Notificações push.
- Renda variável.
- Categorização por swipe.

## Risco / observação
A página depende de o usuário ter pelo menos 1 orçamento definido pra brilhar. Por isso o estado vazio é caprichado e empurra o usuário a definir o primeiro em 2 toques. Sem isso, a feature parece quebrada.
