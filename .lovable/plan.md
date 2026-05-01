## Entendimento

Hoje em `/app/conexoes`, ao clicar em "Nova conexão", abrimos o widget oficial `PluggyConnect` apenas com `connectToken` e `includeSandbox: false`. Sem mais opções, o widget mostra a tela completa de seleção de bancos e, em alguns conectores Open Finance, decide sozinho mostrar QR Code mesmo em celular — foi o que aconteceu com Inter e Bradesco no relato.

A correção mínima é configurar o widget para que, em mobile, ele use redirect direto ao banco (sem QR), e que Open Finance seja sempre priorizado quando disponível. Não vamos reescrever o fluxo nem criar tela própria de seleção — Pluggy continua dona da seleção e do redirect.

## Open questions
Nenhuma — escopo confirmado: apenas correção mobile OF, mantendo PluggyConnect.

## Arquivos a alterar

- `src/pages/app/Conexoes.tsx` — passar opções extras ao `PluggyConnect` baseadas em `useDeviceType()`, ajustar copy de aviso pré-redirect.

Nenhuma mudança em edge function, banco ou outras telas.

## Plano

1. **Detecção de dispositivo já existe** (`useDeviceType()`). Reutilizar.

2. **Configurar `PluggyConnect` com opções mobile-aware:**
   - `connectorTypes: ["PERSONAL_BANK", "BUSINESS_BANK"]` — mantém escopo PF/PJ que já suportamos.
   - Em **mobile**: passar `selectedConnectorIds` vazio, mas habilitar a flag do SDK que prioriza fluxo de redirect (`useApp: true` quando suportada pela versão do SDK; em conjunto com o user-agent mobile, o widget abre o app/site do banco em vez de QR).
   - Manter `includeSandbox: false`.

3. **Pré-aviso de redirect no mobile:** antes de chamar `pluggyConnect.init()`, em mobile, mostrar um `toast` informativo curto: "Você será redirecionado ao seu banco para autorizar com segurança." Em desktop, manter comportamento atual (widget abre com seleção + QR quando aplicável).

4. **Sem mudança em desktop:** desktop continua com o widget padrão (QR é aceitável e esperado em desktop).

5. **Validação manual** (não há como testar PluggyConnect em unitário sem mockar o SDK inteiro):
   - Desktop: abrir conexão, ver lista de bancos, escolher Inter → deve renderizar QR Code (ok).
   - Mobile (DevTools device emulation + teste real em celular): abrir conexão → toast informativo aparece → ao escolher Inter/Bradesco/Itaú, widget redireciona ao app/site do banco, sem QR.
   - Bancos sem OF (credential-based, ex: Mercado Pago): widget continua mostrando o form oficial Pluggy — não tocamos nesse fluxo.

## Riscos de regressão

- **SDK Pluggy:** a flag exata para forçar redirect mobile depende da versão do `pluggy-connect-sdk` instalado. Se a opção não existir no contrato atual, o widget já decide via user-agent — então no pior caso a mudança é neutra (não piora). Verificaremos a versão antes de aplicar e usaremos apenas opções documentadas.
- **Desktop:** nenhum impacto — só adicionamos comportamento condicional para mobile.
- **Reautenticação (`itemId` em `pluggy-connect-token`):** continua funcionando, não mexemos nessa rota.
- **Sync pós-conexão:** `pluggy-register-item` + `pluggy-sync-data` continuam idênticos.

## Detalhes técnicos

Mudança concentrada em `startConnection()` de `Conexoes.tsx`:

```ts
const isMobile = device === "mobile";

if (isMobile) {
  toast.info("Você será redirecionado ao seu banco para autorizar com segurança.");
}

const pluggyConnect = new PluggyConnect({
  connectToken: token,
  includeSandbox: false,
  connectorTypes: ["PERSONAL_BANK", "BUSINESS_BANK"],
  // Em mobile, instruímos o widget a preferir abrir o app/site do banco
  // (Open Finance redirect) em vez de gerar QR Code.
  ...(isMobile ? { useApp: true } : {}),
  onSuccess: async (itemData) => { await registerItem(itemData.item.id); },
  onError: (err) => { toast.error("Conexão não concluída", { description: err?.message }); },
  onClose: () => { setConnecting(false); },
});
```

Antes de implementar, confirmaremos no `package.json` a versão do `pluggy-connect-sdk` e validaremos que `useApp`/equivalente existe naquela versão. Se não existir, mantemos somente `connectorTypes` + toast informativo (que já é melhoria) e documentamos no commit.

## Sugestão de commit

`fix(conexoes): forçar redirect Open Finance em mobile no PluggyConnect`
