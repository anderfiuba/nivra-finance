
## Diagnóstico

### Bug do Patrimônio (R$ 1.531,54 em vez de R$ 765,77)
A conta NuBank correta retorna do Pluggy:
- `balance = 765,77`
- `automatically_invested_balance = 765,77`

O Pluggy já **inclui o saldo investido dentro do `balance`**. O código atual (`FinanceContext.netWorth`) soma os dois → duplica o valor (765,77 × 2 = 1.531,54). É exatamente o erro reportado.

### Cards vazios no Dashboard
Confirmado no banco: existem **69 transações em abril/2026** e **3 contas BANK** + **3 cartões CREDIT**. Porém o card "ENTRADAS NO CICLO" mostra R$ 0,00 na imagem do usuário. Causa: o Dashboard usa `cycleTransactions` (filtra pelo `cycleDay` que o usuário configurou para faturas de cartão). Se o `cycleDay` está, por exemplo, em 26+, o "ciclo atual" começou hoje e está vazio. Mesma raiz para "Principais categorias" e "Movimentações recentes".

A solução é o Dashboard usar **mês civil corrente** (1º → último dia do mês), que é o padrão da referência visual e o que o usuário espera. O conceito de "cycleDay" continua válido para a página de Faturas, mas não deve governar o Dashboard.

### Faturas do mês vazias
Todas as faturas no banco estão `paid=true` (incluindo a de 08/04/2026). O card só mostra faturas com `due_date` no mês civil corrente E `effectivePaid=false` → fica vazio. Vamos:
1. Tornar a busca tolerante: se não houver faturas com vencimento no mês corrente, usar a próxima fatura em aberto (mais próxima).
2. Sempre mostrar pelo menos um resumo amigável quando não há nada (estado "tudo em dia").

### Contas duplicadas no banco
Observação adicional: existem 2 cópias de cada conta NuBank (BANK 15,77 × 2) e 2 cópias do cartão `gold` com balance −4106,91 (provavelmente reconexões antigas onde o item foi recriado mas o registro antigo não foi limpo). Isso infla `totalBalance` mas, após o fix do Patrimônio, o valor vai mostrar 765,77 + 15,77 + 15,77 ≈ 797,31 — ainda visivelmente errado, embora muito mais próximo. **Vou tratar isso como item separado** (limpeza de pluggy_items órfãos) para manter este plano focado nos itens reportados pelo usuário; menciono porque o número final pode não bater com 765,77 redondo até essa limpeza acontecer.

## Plano de implementação

### 1. Correção do Patrimônio (`src/contexts/FinanceContext.tsx`)
Trocar a fórmula `netWorth` para **não somar `automaticallyInvestedBalance`** — ele já está dentro de `balance`:

```ts
const netWorth = useMemo(() => {
  return accounts.reduce((sum, a) => {
    const type = (a.type ?? "").toUpperCase();
    if (type === "CREDIT") return sum;       // cartões fora
    return sum + (a.balance ?? 0);           // balance JÁ inclui investido
  }, 0);
}, [accounts]);
```

Atualizar comentário do campo `automaticallyInvestedBalance` na interface para deixar claro que é apenas informativo (parcela do `balance` que está rendendo).

### 2. Dashboard usar mês civil em vez de ciclo (`src/pages/app/Dashboard.tsx` e `FinanceContext.tsx`)
Adicionar dois novos selectors no `FinanceContext` paralelos aos atuais:
- `monthTransactions` — transações do mês civil corrente
- `monthTotals` / `previousMonthTotals` — totais do mês civil corrente / anterior
- `expensesByCategoryMonth` — agregação por categoria do mês civil corrente

No Dashboard, trocar:
- "Entradas/Saídas/Resultado **no ciclo**" → "**no mês**" (rótulo) e usar `monthTotals` + `previousMonthTotals`
- "Movimentações recentes" → últimas 8 do mês civil
- "Principais categorias" → `expensesByCategoryMonth`
- Atualizar header "Visão consolidada do ciclo X" → "Visão consolidada de **abril/2026**"

(O `cycleDay` permanece em uso na página `Faturas.tsx` — não mexemos lá.)

### 3. Faturas do mês — fallback para próxima fatura em aberto (`Dashboard.tsx`)
```ts
const openBills = useMemo(() => {
  // 1) prioriza faturas em aberto com due_date no mês civil
  const inMonth = bills.filter(b => !b.effectivePaid && b.dueDate
    && new Date(b.dueDate).getMonth() === now.getMonth()
    && new Date(b.dueDate).getFullYear() === now.getFullYear());
  if (inMonth.length > 0) return inMonth;
  // 2) fallback: próxima fatura em aberto (qualquer mês futuro)
  return bills.filter(b => !b.effectivePaid && b.dueDate
    && new Date(b.dueDate) >= now)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .slice(0, 3);
}, [bills]);
```
Se ainda assim ficar vazio, mostrar mensagem "Tudo em dia. Próxima fatura ainda não fechou." com link para Faturas.

### 4. Histórico do Patrimônio — últimos 3 meses
**Decisão**: como não temos snapshots históricos do balance no banco, vamos derivar do extrato:

**Patrimônio em t** = saldo_atual − (entradas_BANK depois de t) + (saídas_BANK depois de t)

Funciona porque toda transação BANK movimenta o `balance` final. Cartões (CREDIT) ficam de fora (afetam fatura, não patrimônio).

Vou criar um novo selector `patrimonyHistory` no `FinanceContext` que retorna 90 pontos diários (últimos 3 meses). Implementação:
1. Soma BANK balances atuais → ponto de hoje.
2. Itera transações BANK em ordem decrescente, para cada dia anterior subtrai entradas e soma saídas → vai "desfazendo" até 90 dias atrás.
3. Retorna `[{ date: "2026-01-26", value: 432.10 }, ...]` ordenado crescente.

Adicionar novo card no Dashboard `<PatrimonyHistoryCard />` logo abaixo da grid de KPIs (posição da imagem-1):
- Title "HISTÓRICO DO PATRIMÔNIO"
- AreaChart do Recharts (já temos), gradient azul, eixo Y formatado em BRL compacto (R$ 800), eixo X em DD/MM.
- Sem botões 1D/1W/etc na primeira versão (escopo: 3 meses fixos, conforme pedido). Posso adicionar depois se quiser.

### 5. Limpeza
Não removo `cycleTransactions` etc — outras telas usam.

## Arquivos editados
- `src/contexts/FinanceContext.tsx` — fix do `netWorth`, novos selectors `monthTotals`/`previousMonthTotals`/`expensesByCategoryMonth`/`patrimonyHistory`
- `src/pages/app/Dashboard.tsx` — usar mês civil, fallback de faturas, novo card de histórico
- Novo componente: `src/components/dashboard/PatrimonyHistoryCard.tsx` (AreaChart)

## Não vou tocar
- `cycleDay` / página Faturas — segue como está
- Migrations de banco — não precisamos de tabela de snapshots; derivamos do extrato

## Observação para o usuário
Após o fix, o Patrimônio vai mostrar ~R$ 797,31 (765,77 + 15,77 + 15,77 das duas cópias da mesma conta NuBank que vieram de reconexões anteriores). Para chegar exatamente em R$ 765,77 precisamos limpar contas órfãs — me avise se quer que eu trate isso em seguida.
