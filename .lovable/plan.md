## Objetivo

Refatorar `/app/contas` para seguir o conceito da imagem de referência:
- Remover o card "Saldo total consolidado".
- Agrupar em **3 seções colapsáveis**: Cartões de Crédito, Contas Bancárias e Conexões.
- Cada item do grupo mostra logo do banco, nome, marca/tipo, "há Xh" da última sync, e saldo à direita.
- Cada grupo tem um rodapé **TOTAL** com barrinha lateral colorida (vermelha p/ cartões, verde p/ contas).
- Conexões traz o conector com badge "Atualizado" + Nº de contas + botão "Desconectar".
- Layout 100% legível em mobile (sem sobreposição de informação).

---

## Mudanças propostas

### 1. `src/pages/app/Contas.tsx` — refatoração completa
- **Remover** o card `Saldo total consolidado` e o uso de `totalBalance`.
- **Header** simplificado: título "Contas" + botão "Adicionar conta" (mantém atual).
- Implementar **3 seções colapsáveis** usando `Collapsible` do shadcn (`@/components/ui/collapsible`) para que em mobile o usuário possa fechar grupos:
  - **Cartões de Crédito** (filtra `type === "CREDIT"`)
  - **Contas Bancárias** (demais tipos)
  - **Conexões** (lista de `pluggy_items`, agregando contagem de contas por item)
- Cada card é branco (usa `bg-card`) com borda fina e cantos arredondados, conforme imagem.

### 2. Estrutura de cada item

**Cartões:**
```
[logo] gold                                    R$ 4.106,91
       Nubank                          [████████░░] 79.7%
       há 5h                           Limite: R$ 5.150,00
```
- Logo do banco (vem de `pluggy_items.connector_image_url` / `connector_primary_color`) — buscar via join no contexto (ver item 4).
- Nome do cartão + marketing/marca + "há Xh" (relativo a `pluggy_items.last_synced_at`).
- Saldo em vermelho à direita, barra de % de uso, limite abaixo.
- Mobile: barra ocupa largura total da coluna direita; nome trunca com ellipsis.

**Contas bancárias:**
```
[logo] Nu Pagamentos S.A.                      R$ 765,77
       Nubank                                   Saldo atual
       há 5h
```
- Mesmo layout, sem barra de uso. "Saldo atual" como label cinza abaixo do valor.
- Caso não tenha logo (ex: "Carteira"), usar ícone genérico (`Wallet`) com fundo cinza.

**Total do grupo (rodapé do card):**
```
| TOTAL                                        -R$ 4.106,91   (vermelho p/ cartões)
| TOTAL                                         R$ 765,77     (verde p/ contas)
```
- Barrinha lateral de 3px (vermelha/verde) + label TOTAL em cinza pequeno + valor à direita.

**Conexões:**
```
[logo] Nubank                                  ↻ Desconectar
       ● Atualizado · 2 contas
```
- Badge verde "Atualizado" (mapeia `STATUS_OK` de Conexões.tsx).
- Texto "X contas" baseado no `count` de `pluggy_accounts` por `pluggy_item_id`.
- Botão "Desconectar" em vermelho (texto), abrindo o mesmo `AlertDialog` já existente em Conexões → vou extrair a lógica de remoção para reuso (ver item 5).

### 3. Comportamento mobile

- Seções **colapsáveis** com chevron up/down no canto superior direito (idêntico à imagem).
- Item layout em `flex` que vira `flex-col` em telas `< sm`:
  - Logo + bloco de texto na primeira linha.
  - Bloco de valor (saldo + barra/limite) embaixo, alinhado à direita.
- Padding reduzido em mobile (`p-4` vs `p-5` desktop).
- Truncamento de nomes longos com `truncate` + tooltip.
- Não usar `flex-wrap` que quebra a hierarquia visual; usar grid ou stack vertical em `< sm`.

### 4. Carregar metadados de conexões no `FinanceContext`

Hoje `FinanceAccount` não traz `connector_image_url`, `connector_primary_color`, `pluggy_item_id` nem `last_synced_at`. Para mostrar logo + "há Xh" sem disparar fetch separado:

- Adicionar query de `pluggy_items` no `refresh()` do `FinanceContext.tsx` (já carrega tudo paralelamente).
- Expor novo estado `items: PluggyItem[]` com campos: `pluggy_item_id`, `connector_name`, `connector_image_url`, `connector_primary_color`, `status`, `last_synced_at`.
- Adicionar `pluggyItemId`, `connectorImageUrl`, `connectorPrimaryColor`, `lastSyncedAt` ao `FinanceAccount` (resolvidos via join em memória pelo `pluggy_item_id` da tabela `pluggy_accounts`).
- ⚠️ A coluna `pluggy_item_id` já existe em `pluggy_accounts` mas o select atual em `FinanceContext` **não a busca** — precisa adicionar ao `.select(...)`.

### 5. Reutilizar lógica de "Desconectar"

Para evitar duplicar a chamada `pluggy-delete-item` + `AlertDialog`:
- Criar componente `src/components/contas/DisconnectButton.tsx` que recebe `itemId`, `connectorName` e callback `onRemoved`.
- Usá-lo tanto em `Contas.tsx` (nova página) quanto em `Conexoes.tsx` (refatorar para consumir).
- Após remoção, chamar `refresh()` do `FinanceContext` para atualizar UI.

### 6. Função utilitária

- Reaproveitar `formatRelative()` existente em `Conexoes.tsx` movendo para `src/lib/format.ts` (export `formatRelativeTime`). Usar nas duas páginas.

### 7. Estado vazio

- Se não há cartões: ocultar a seção Cartões (não exibir card vazio).
- Se não há contas bancárias: ocultar a seção Contas Bancárias.
- Se não há conexões: mostrar empty state atual (com botão "Conectar primeira conta").

---

## Arquivos impactados

**Editados:**
- `src/pages/app/Contas.tsx` — refatoração completa.
- `src/contexts/FinanceContext.tsx` — adicionar query de `pluggy_items`, expor `items`, enriquecer `FinanceAccount`.
- `src/lib/format.ts` — adicionar `formatRelativeTime`.
- `src/pages/app/Conexoes.tsx` — usar `DisconnectButton` extraído e `formatRelativeTime` compartilhado (sem mudança visual).

**Criados:**
- `src/components/contas/DisconnectButton.tsx` — botão + AlertDialog reutilizável.
- `src/components/contas/AccountGroupCard.tsx` — card colapsável com header (título + count) e rodapé TOTAL.
- `src/components/contas/AccountRow.tsx` — linha individual de conta/cartão (com variant `bank` | `credit`).
- `src/components/contas/ConnectionRow.tsx` — linha individual de conexão (com badge + botão desconectar).

---

## Pontos a confirmar antes de implementar

1. **Logo do banco em "Carteira"** (conta manual sem connector): manter ícone `Wallet` cinza ou esconder?
2. **Total do grupo Cartões**: mostrar como negativo (`-R$ 4.106,91` em vermelho, como na imagem) ou positivo (valor da dívida em vermelho sem sinal)?
3. **Cor do header** dos cards (Cartões/Contas/Conexões): seguir a imagem (fundo branco/cinza claro) ou manter o `bg-gradient-card` atual do app dark?
