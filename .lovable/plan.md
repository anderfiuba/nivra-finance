## Diagnóstico — por que Nivra mostra R$ 266,19 enquanto Nubank mostra R$ 897,81

Investiguei os dados reais no banco. Há **três problemas distintos** que somados geram a diferença, e um problema visual de duplicidade:

### Problema 1 — Janela do ciclo errada (causa principal: ~R$ 631)

Você configurou **Fechamento dia 7** e **Vencimento dia 8**. O Nubank, porém, fecha **dia 1** e vence **dia 8** (você mesmo confirmou). Com isso:

- Nivra calcula o ciclo atual como **08/04 → 07/05** (vence 08/05).
- Nubank/Visor calculam **02/04 → 01/05** (vence 08/05).

Resultado: Nivra **não está contando** as compras feitas entre 02/04 e 07/04, que já caíram no ciclo aberto do Nubank. Isso explica a maior parte do gap.

> **Ação imediata recomendada:** abrir o card de configuração e mudar fechamento de **7 → 1**. Mas isso sozinho não basta — veja problemas 2 e 3.

### Problema 2 — Pagamento da fatura anterior está sendo somado como compra (~R$ 0, mas conceitualmente errado)

A transação `Pagamento recebido` de **−R$ 801,02** em 23/04 é um `CREDIT` (entrada de pagamento). Hoje o filtro `txsInWindow` em `Faturas.tsx` ignora `type !== "saida"`, então isso já está OK — **mas** no app Visor essa transação aparece zerando, e o cálculo deve continuar coerente. Verificar se nosso mapeamento de `type` em `FinanceContext` está classificando `CREDIT` como `entrada` corretamente para esse caso. Se não, a fatura cresce indevidamente.

### Problema 3 — Contas de cartão duplicadas no banco (causa maior do "Total a pagar" inflado: R$ 1.067,21)

Existem **3 registros** em `pluggy_accounts` para o cartão "gold":
- `5e6401ee-…` — gold, balance −4106,91, 43 transações (sync antigo)
- `f665c728-…` — gold, balance −4106,91, 43 transações (sync antigo)
- `f6dafb7e-…` — gold 1077, **conta atual** (com bills, cycle settings, 121 transações)

As duas contas antigas (sem `card_number_last4`) **não têm cycle settings**, então caem no "banner de configuração". Mas no `openItems`, sem `days` resolvido, elas são ignoradas — então não inflam o total. **Porém** elas inflam o "Total consolidado" em outras telas e poluem a UI. Precisam ser **deletadas** (ou marcadas como inativas).

### Problema 4 — Fatura fechada de 08/04 (R$ 801,02) está marcada como "Vencida" mesmo após pagamento

A bill com `due_date = 2026-04-08` tem `paid = false`, mas existe a transação `Pagamento recebido −R$ 801,02` em 23/04 com valor exatamente igual. O Pluggy não atualiza `paid`, então ela continua aparecendo como "Vencida há 17 dias" e somando R$ 801,02 ao "Total a pagar" — quando na verdade já foi paga.

É por isso que Nivra mostra **R$ 1.067,21** (R$ 801 fatura "vencida" + R$ 266 ciclo atual) enquanto Visor mostra apenas **R$ 246,77** (só ciclo atual, fatura paga reconhecida).

---

## Plano de correção

### 1. Auto-detecção de pagamentos de fatura → marcar `paid=true`

Criar utilitário `inferBillPayment(bill, transactions)` que marca uma bill como paga quando existe `pluggy_transaction` no mesmo `pluggy_account_id` com:
- `type = 'CREDIT'` (ou amount negativo em conta de crédito)
- `description` matching `/pagamento.*recebido|pagamento.*fatura|payment.*received/i`
- `|amount|` dentro de ±2% do `total_amount` da bill
- `transaction_date` entre `due_date - 30d` e `due_date + 15d`

Aplicar em duas frentes:
- **Edge function `pluggy-sync-data`**: após inserir bills + transactions, rodar a inferência e fazer `UPDATE pluggy_bills SET paid=true WHERE …`.
- **Cliente (`FinanceContext`)**: como fallback imediato para o usuário, computar `effectivePaid = bill.paid || inferPaid(bill, txs)` ao montar `bills`. Sem nova migration; só lógica.

Bills marcadas como pagas:
- saem do `openItems` em `Faturas.tsx` (não somam ao "Total a pagar"),
- entram em `paidItems` ("Recentemente Pagas") imediatamente.

### 2. Limpar contas de cartão duplicadas

As contas `5e6401ee-…` e `f665c728-…` são lixo de syncs antigos (mesmo cartão, mesmo balance, mesmo histórico). Criar **migration** que:
- Identifica accounts órfãs: aquelas cujo `pluggy_item_id` não existe mais em `pluggy_items` para o `user_id`, OU
- Identifica duplicatas: mesmo `(user_id, name, type)` mantendo só a mais recente com transações vinculadas.
- Deleta as órfãs e suas transações associadas.

Adicionalmente, atualizar `pluggy-sync-data` para deletar accounts que não voltam mais do Pluggy (já existe a lógica de items, falta para accounts dentro de um item).

### 3. Banner de aviso quando fechamento configurado diverge das transações

No card de configuração de ciclo (`ConfigCiclosCard`), quando o usuário tiver bills do Pluggy disponíveis para o cartão, **inferir** o `closing_day` real a partir do dia da semana/mês das `due_date` históricas (vencimento − N dias úteis padrão). Exibir sugestão: "Detectamos que seu cartão fecha no dia X com base nas faturas anteriores". Botão "Usar esses valores".

Isso evita que o usuário configure 7/8 (errado) quando o real é 1/8.

### 4. Pequenos ajustes em `Faturas.tsx`

- Ao montar `openItems`, **respeitar `effectivePaid`**: se a bill anterior foi paga (inferida), não adicionar como "fechada" no painel.
- Adicionar tooltip no "Total a pagar" listando exatamente o que está somando: "Ciclo atual cartão X: R$ Y · Fatura fechada cartão Z: R$ W".
- Mostrar nota informativa "Pagamento de R$ 801,02 detectado em 23/04 — fatura marcada como paga automaticamente" nas faturas inferidas.

### 5. (Opcional) Página de comparação

Adicionar pequeno painel de debug em `/app/faturas` (visível só em dev ou via flag) que mostra lado a lado, para cada cartão:
- Fechamento configurado vs. inferido pelo histórico de bills.
- Janela do ciclo atual usada.
- Soma de transações dessa janela.
- Bills do Pluggy dentro/fora dessa janela.

Isso facilita debugar discrepâncias futuras sem precisar consultar o banco.

---

## Arquivos afetados

**Editar:**
- `supabase/functions/pluggy-sync-data/index.ts` — inferência de pagamento + limpeza de accounts órfãs.
- `src/contexts/FinanceContext.tsx` — campo `effectivePaid` em `FinanceBill`, exposição da inferência client-side.
- `src/pages/app/Faturas.tsx` — usar `effectivePaid`, ajustar `openItems` e `paidItems`, tooltip no total.
- `src/components/faturas/ConfigCiclosCard.tsx` — sugestão de fechamento inferido das bills.
- `src/components/faturas/TotalPagarCard.tsx` — breakdown detalhado por cartão (tooltip ou expansão).

**Novo:**
- `src/lib/billPayment.ts` — utilitário de inferência de pagamento (puro, testável).
- `supabase/migrations/<ts>_cleanup_duplicate_credit_accounts.sql` — migration única para limpar as 2 accounts órfãs do seu user.

---

## Resultado esperado após aplicar

Para o seu caso:
- Fatura `due 08/04` (R$ 801,02) → marcada como paga automaticamente, sai de "Ciclos de Faturamento", entra em "Recentemente Pagas".
- Após você ajustar fechamento para **dia 1**, o ciclo atual passa a ser **02/04 → 01/05** e a soma deve bater com Nubank/Visor (~R$ 897 considerando IOF e juros, ~R$ 246 se descontar essas multas como o Visor faz).
- **Total a pagar** deixa de mostrar R$ 1.067 e passa a mostrar apenas o ciclo atual (~R$ 250–900 dependendo do que considerar).
- Contas duplicadas somem.

Quer que eu também investigue por que o Visor mostra R$ 246 e o Nubank R$ 897 (provavelmente o Visor está excluindo multas/juros automáticos do "Total a pagar" e listando-os à parte)?
