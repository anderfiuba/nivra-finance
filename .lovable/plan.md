# Corrigir retorno do OAuth Open Finance (mobile) — item se perde após redirect

## Entendimento

No fluxo atual em `src/pages/app/Conexoes.tsx`, em mobile, configuramos `oauthRedirectUri = /app/conexoes` e abrimos o `PluggyConnect` com `forceOauthInBrowser: true`. O usuário sai do Nivra → autoriza no app do banco (Inter) → o banco redireciona para `/app/conexoes`.

O problema: ao voltar para o Nivra via redirect do banco, **uma nova aba/contexto da SPA é aberta**. Essa nova instância **não tem o `PluggyConnect` em memória**, portanto:

- O callback `onSuccess(itemData)` **nunca dispara** nessa nova aba.
- `pluggy-register-item` nunca é chamado.
- O item existe na Pluggy, mas não é gravado em `pluggy_items` no nosso banco.
- A tela de Conexões aparece vazia mesmo com a autorização concluída no banco.

Esse é exatamente o sintoma relatado (Inter autorizou, voltou para o Nivra, conexão não apareceu).

## Causa raiz

Faltam duas coisas:

1. Pluggy, ao retornar do OAuth, anexa parâmetros à `oauthRedirectUri` (tipicamente `?item_id=...&status=...` ou similar). Não estamos lendo esses parâmetros na volta.
2. Não temos fallback que reconcilie itens criados na Pluggy mas ausentes no nosso `pluggy_items` (caso onde nem o query param chega — ex.: redirect via app nativo abrindo browser externo diferente do que iniciou).

## Arquivos a alterar

- `src/pages/app/Conexoes.tsx` — detectar `item_id` na query string ao montar e chamar `registerItem`. Limpar a URL após processar.
- `supabase/functions/pluggy-list-items/index.ts` — (verificar) listar também itens órfãos da Pluggy filtrados pelo `clientUserId = user.id` que ainda não estão no nosso banco, para servir de fallback de reconciliação.
- `supabase/functions/pluggy-register-item/index.ts` — já aceita `itemId` e valida ownership via JWT; nenhuma mudança de contrato, apenas garantir que retorna o registro.
- Novo helper `src/lib/pluggyReturnFlow.ts` (puro) — extrai `item_id`/`status`/`error` da `URLSearchParams`, isolável para teste unitário.
- Novo teste `src/test/regression/pluggyReturnFlow.regression.test.ts` — cobre os formatos de query conhecidos do Pluggy.

## Plano de implementação

1. **Helper puro (`pluggyReturnFlow.ts`)**
   - `parsePluggyReturn(search: string): { itemId?: string; status?: string; error?: string }`.
   - Aceita chaves comuns: `item_id`, `itemId`, `status`, `error`.

2. **Hook de retorno em `Conexoes.tsx`**
   - Em `useEffect` de mount, ler `window.location.search`.
   - Se houver `itemId`: chamar `registerItem(itemId)` (já existente, idempotente via `upsert onConflict pluggy_item_id`), depois `loadItems()`, depois `history.replaceState({}, "", "/app/conexoes")` para limpar a URL.
   - Se houver `error`: `toast.error` com mensagem amigável e limpar a URL.
   - Guardar flag local para não reprocessar em hot reload.

3. **Fallback de reconciliação (defensivo, sem mudar contrato externo)**
   - Após `loadItems()`, se nenhum item retornar **e** acabamos de voltar de um fluxo de conexão (sessionStorage flag `pluggy:connecting=true` setada antes de `pluggyConnect.init()`), chamar uma rota nova `pluggy-reconcile-items` que:
     - Lista `/items?clientUserId={user.id}` na Pluggy.
     - Para cada item ausente em `pluggy_items` do user, faz upsert (mesma lógica de `pluggy-register-item`).
     - Retorna IDs reconciliados.
   - Limpa a flag após executar.
   - Isso cobre o caso em que o redirect do banco abre o navegador em uma instância sem query string (ex.: deep-link para PWA/app já aberto em outra aba).

4. **Marcação `pluggy:connecting`**
   - Antes de `pluggyConnect.init()` em `startConnection`, gravar `sessionStorage.setItem("pluggy:connecting", Date.now().toString())`.
   - Limpar após `onClose`/`onSuccess`/processamento do retorno.

5. **Testes**
   - Unitário: `parsePluggyReturn` com várias query strings (incluindo vazio, `?item_id=abc`, `?itemId=abc&status=UPDATED`, `?error=USER_CANCELLED`).
   - Regressão existente `pluggyMobileRedirect.regression.test.ts` continua válida.

## Detalhes técnicos

```text
Fluxo corrigido (mobile):

  startConnection
    ├─ sessionStorage["pluggy:connecting"] = ts
    ├─ POST /pluggy-connect-token { openFinanceOnly, oauthRedirectUri }
    └─ PluggyConnect.init() → abre browser do sistema
          └─ App do banco (Inter) → autoriza
                └─ Redirect → /app/conexoes?item_id=<id>&status=...
                      ├─ useEffect lê item_id
                      ├─ registerItem(item_id) → upsert pluggy_items
                      ├─ pluggy-sync-data { itemId }
                      ├─ loadItems()
                      └─ history.replaceState → /app/conexoes (limpa URL)

Fallback (sem query param):
  loadItems vazio + flag "pluggy:connecting" recente (<10min)
    └─ POST /pluggy-reconcile-items
          └─ Lista itens do user na Pluggy → upsert os ausentes
```

- `registerItem` já é idempotente (upsert por `pluggy_item_id`), então rodar em ambos os caminhos (callback `onSuccess` no desktop e query-param/reconcile no mobile) é seguro.
- Não alteramos RLS nem schema.
- Não alteramos o token: `oauthRedirectUri` já é enviado em `payload.options`.

## Riscos de regressão

- **Desktop QR Code**: continua usando `onSuccess` callback in-memory; nenhuma mudança de comportamento.
- **Reauth de item existente**: `oauthRedirectUri` continua sendo enviado quando aplicável; o reconcile faz upsert por `pluggy_item_id`, então não duplica.
- **URL cleanup**: usar `history.replaceState` evita loop de re-render via React Router.
- **Sync após reconcile**: disparar `pluggy-sync-data` para cada item reconciliado, igual ao `registerItem`.

## Validação

- **Manual mobile (Inter/Bradesco)**: iniciar conexão → autorizar no app do banco → confirmar que ao voltar a conta aparece em `/app/conexoes` sem refresh manual.
- **Manual mobile cancelamento**: cancelar no banco → confirmar toast de erro e URL limpa.
- **Manual desktop**: QR Code continua funcionando (sem regressão).
- **Automatizado**: `parsePluggyReturn` cobre formatos de query.

## Escopo NÃO incluído

- Webhooks da Pluggy (`item/created`) — fora do escopo mínimo, pode ser próximo passo se reconcile não for suficiente.
- Mudanças no widget desktop.
- Mudanças em outras funções edge.

## Commit sugerido

`fix(conexoes): tratar retorno OAuth mobile e reconciliar itens órfãos da Pluggy`
