
## Objetivo
Simplificar toda a UI para mostrar **apenas categorias pai** (top-level). Filhas continuam vindo da Pluggy por baixo, mas resolvemos para o pai correspondente usando o catálogo `/categories` (já sincronizado em `pluggy_categories`, com `parent_id` / `parent_description`).

---

## 1. Resolução automática para o PAI no Extrato/Dashboard

**`src/contexts/FinanceContext.tsx`** — função `effectiveCategory` (linhas ~285-302).

Hoje resolve a categoria efetiva como filha (ex.: `Restaurantes, bares e lanchonetes`). Vou trocar por uma função `resolveToParent(categoryId, fallbackDescription)` que:
1. Procura o nó no catálogo via `category_id`.
2. Se o nó tem `parent_id`, busca o **pai** e retorna `descriptionTranslated` do pai (ex.: `Alimentos e bebidas`).
3. Se já é pai (`parent_id IS NULL`), retorna ele mesmo.
4. Fallback: tenta `category_pluggy` em `catByDescription`, mesma lógica.
5. Override manual (`t.category`) continua tendo prioridade — mas agora a UI só oferece pais (ver §2), então o override também será sempre um pai.

Resultado: **toda transação no Extrato exibe categoria PAI** (ex.: `Alimentos e bebidas`, `Serviços`, `Renda`), independente da granularidade da Pluggy.

---

## 2. Seletor do Extrato — só categorias PAI

**`src/pages/app/Extrato.tsx`** — bloco `groupedCategories` (linhas ~24-40) e o `<Select>` da transação (linhas ~149-165).

- Trocar `groupedCategories` por `parentCategories`: filtrar `categories` por `parentId === null`, ordenar por `descriptionTranslated`. Lista enxuta de ~20 itens.
- Remover o seletor agrupado (header cinza + filhas indentadas). Vira um `<Select>` flat: só os pais.
- Filtro do topo "Categoria" também passa a listar apenas pais (agora coerente, já que toda transação resolve para pai).

Removido: `categoryFilterOptions` baseado em `t.category` distintos (que misturava filhas).

---

## 3. Seletor de Orçamentos — só PAIs

**`src/pages/app/Categorizacao.tsx`** — bloco `groupedCategoryOptions` (linhas ~55-75) e dialog "Novo orçamento".

- Substituir pelo mesmo `parentCategories` (somente pais).
- Remover hierarquia visual (cabeçalho + indentação de filhas). Lista flat.
- A lógica de agregação no `budgetProgress` (`FinanceContext.tsx` linhas 549-607) **continua intacta** — ela já soma filhas no pai. Mas como agora todo orçamento é pai e toda transação resolve para pai, a parte de "fallback exato" e `labelToParentLabel` fica redundante. Vou simplificar: `spent = spentMap.get(b.categoryLabel) ?? 0`. Mais limpo, mesmo resultado.

---

## 4. Limpar overrides antigos no banco (opção que você escolheu)

Existem **4 transações** com `category` preenchido manualmente (de um total de 424). Vou rodar uma migração de dados que zera apenas os overrides cuja categoria salva **não seja** o nome de uma categoria pai do catálogo:

```sql
UPDATE pluggy_transactions
SET category = NULL
WHERE category IS NOT NULL
  AND category NOT IN (
    SELECT description_translated
    FROM pluggy_categories
    WHERE parent_id IS NULL
  );
```

Como nenhum dos 4 overrides atuais provavelmente bate com nome de pai (já que a UI antiga oferecia pai+filha misturados), o efeito esperado é: limpar todos os 4. Eles passam a herdar a categoria PAI vinda da Pluggy automaticamente. Quem realmente quiser overrider, refaz pelo seletor novo (que só mostra pais → fica consistente).

---

## 5. Ajuste cosmético: categoria PAI sempre exibida

No card da transação no Extrato, hoje mostramos `t.category` cru. Vou exibir sempre a categoria pai resolvida (já vem assim do contexto após §1). Sem mudança extra de markup.

---

## Arquivos afetados

**Editados:**
- `src/contexts/FinanceContext.tsx` — `effectiveCategory` resolve para pai; simplificar `budgetProgress`.
- `src/pages/app/Extrato.tsx` — `parentCategories`, seletor flat, filtro de categoria por pais.
- `src/pages/app/Categorizacao.tsx` — seletor de orçamento flat (só pais).

**Migração de dados (insert tool):**
- `UPDATE pluggy_transactions SET category = NULL WHERE category NOT IN (pais)`.

---

## Fora do escopo
- Não vou apagar categorias filhas do `pluggy_categories` — a sincronização do catálogo continua trazendo tudo da Pluggy (precisamos das filhas para resolver `category_id` → pai).
- Dashboard usa `expensesByCategoryCycle`, que já agrupa pelo nome resolvido — vai automaticamente passar a agrupar por pai sem mudança extra.

Confirma que posso aplicar?
