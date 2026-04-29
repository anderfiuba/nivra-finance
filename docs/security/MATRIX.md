# Matriz de Segurança — Nivra

> Auditoria de segurança em duas camadas:
> **(A)** hardening básico do site (headers, CORS, transporte) e
> **(B)** segurança real da aplicação (auth, authz, IDOR, segredos, dados,
> Open Finance, regras de negócio).
>
> A coluna **Teste automatizado** referencia o arquivo em
> `src/test/security/` que cobre o item. Itens marcados `e2e` exigem a flag
> `SECURITY_E2E=1` (criam usuários sintéticos contra o backend real).
>
> Ordem de execução obrigatória: **A → B.1 (auth) → B.2 (authz) → B.3
> (api/sessões/secrets) → B.4 (banco/storage/leak) → B.5 (Open Finance) →
> B.6 (regressão funcional)**.

## Legenda

| Símbolo | Significado |
|---------|-------------|
| 🟥 P0   | Bloqueia produção. Corrigir antes de publicar. |
| 🟧 P1   | Corrigir em ≤ 7 dias. Reduz superfície real. |
| 🟨 P2   | Corrigir em ≤ 30 dias. Defense in depth. |
| 🟩 P3   | Melhoria futura / observabilidade. |
| 🟢 OK   | Implementado e testado nesta release. |
| 🟡 WARN | Implementado mas com gap conhecido. Anotado. |
| 🔴 GAP  | Não implementado — entrar no backlog. |

---

## A. Hardening básico do site

| ID | Controle | Estado | Severidade | Teste automatizado | Evidência esperada | Risco de regressão |
|----|----------|--------|------------|--------------------|---------------------|--------------------|
| A.1 | `X-Content-Type-Options: nosniff` no HTML | 🟢 | P1 | `security-headers.security.test.ts` | meta tag presente em `index.html` | nenhum |
| A.2 | `Referrer-Policy: strict-origin-when-cross-origin` | 🟢 | P2 | idem A.1 | meta tag presente | nenhum |
| A.3 | `Permissions-Policy` bloqueando camera/mic/geo/payment/usb | 🟢 | P2 | idem A.1 | meta tag presente | bloquear features futuras (ex.: scan de QR via câmera) — revisar antes de habilitar |
| A.4 | `Content-Security-Policy` (CSP) | 🔴 GAP | 🟧 P1 | `headers-deep.security.test.ts` (asserta ausência conhecida) | meta CSP ausente — TODO report-only | **alto**: bloquear Pluggy Connect (iframe `connect.pluggy.ai`), Google Fonts, inline-styles do Tailwind/shadcn. Iniciar em `Content-Security-Policy-Report-Only`. |
| A.5 | `Strict-Transport-Security` (HSTS) | 🟡 | 🟧 P1 | `headers-deep.security.test.ts` | meta-tag não vale para HSTS — precisa ser **header HTTP real** no edge (Lovable Cloud). Anotado. | nenhum em dev (Lovable serve só HTTPS) |
| A.6 | `X-Frame-Options: DENY` ou CSP `frame-ancestors 'none'` | 🔴 GAP | 🟥 P0 | `headers-deep.security.test.ts` | bloqueia clickjacking. Hoje qualquer site pode iframar `nivrafinance.com`. | nenhum (não usamos auto-embed) |
| A.7 | CORS allowlist nas edge functions (não `*` em endpoints com credenciais) | 🟢 | P0 | `cors.security.test.ts` + `edge-functions.security.test.ts` (e2e) | preflight de origin não-allowlistada não devolve `Access-Control-Allow-Origin` | nenhum — allowlist cobre `lovable.app`, `lovableproject.com` e `nivrafinance.com` |
| A.8 | Apenas HTTPS em chamadas externas (zero `http://` para hosts externos) | 🟢 | P0 | `https-only.security.test.ts` | sem matches no scan | nenhum |
| A.9 | `viewport`, `lang` e SEO sem leakage de dados | 🟢 | P3 | inspeção manual | — | nenhum |

### Plano de adoção do CSP (sem quebrar UI)

1. **Etapa 1 — Coletar.** Adicionar `Content-Security-Policy-Report-Only` no `index.html` permitindo:
   - `default-src 'self'`
   - `connect-src 'self' https://*.supabase.co https://api.pluggy.ai`
   - `img-src 'self' data: https://*.lovable.app https://pub-*.r2.dev`
   - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
   - `font-src 'self' https://fonts.gstatic.com`
   - `frame-src https://connect.pluggy.ai`
   - `script-src 'self'`
   - `frame-ancestors 'none'`
2. **Etapa 2 — Observar.** 7 dias coletando violações no preview/produção.
3. **Etapa 3 — Enforce.** Trocar `Report-Only` por `Content-Security-Policy`.
4. **Etapa 4 — Endurecer.** Remover `'unsafe-inline'` em `style-src` migrando para nonces — só faz sentido depois que Tailwind/shadcn pararem de injetar styles inline (mudança custosa, ⓘ P3).

---

## B.1 Autenticação

| ID | Cenário | Pré-condição | Passos | Resultado esperado | Severidade | Teste automatizado |
|----|---------|--------------|--------|--------------------|------------|--------------------|
| AUTH.1 | Login válido | Usuário cadastrado | POST `/auth/v1/token?grant_type=password` com email+senha corretos | 200 + `access_token` JWT | P0 | `auth-flows.security.test.ts` (e2e) |
| AUTH.2 | Login com senha errada não revela existência do email | — | POST com senha inválida | mensagem genérica `Invalid login credentials`, sem distinguir "user not found" | P1 | `auth-flows.security.test.ts` (e2e) |
| AUTH.3 | Logout invalida sessão local | logado | `supabase.auth.signOut()` + tentar usar token antigo | leitura subsequente com mesmo token deve falhar (signOut limpa storage; backend mantém JWT válido até `exp`, mas refresh é revogado) | P1 | `auth-flows.security.test.ts` (e2e) |
| AUTH.4 | Reset de senha exige clique no link de recuperação | usuário existente | `supabase.auth.resetPasswordForEmail(email)` | 200 + email enviado pelo Supabase; sem link, senha não muda | P1 | `auth-flows.security.test.ts` (verifica chamada do método) |
| AUTH.5 | Página `/reset-password` está pública e atualiza senha | — | abrir rota sem sessão | `<ResetPassword />` renderiza fora do `<ProtectedRoute>` | P0 | `protected-route.regression.test.tsx` (já existe) + inspeção `App.tsx` |
| AUTH.6 | Persistência: refresh do browser mantém sessão | logado | reload | `useAuth().user` permanece após reload | P1 | manual + `protected-route.regression.test.tsx` |
| AUTH.7 | Listener `onAuthStateChange` registrado **antes** de `getSession` | — | code review | em `AuthContext.tsx` linha do listener antecede `getSession()` | P1 | `auth-config.security.test.ts` (regex sobre o arquivo) |
| AUTH.8 | Não usar signInAnonymously | — | scan código | nenhuma chamada | P1 | `auth-config.security.test.ts` ✅ |
| AUTH.9 | Edge functions críticas exigem JWT | — | curl sem `Authorization` | 401 com `error: "unauthorized"` | P0 | `edge-functions.security.test.ts` (e2e) |
| AUTH.10 | Anti brute-force | — | rate limit configurado no GoTrue | Lovable Cloud aplica defaults; documentado em `auth-logs` | P1 | manual (não há API pública de rate limit) |
| AUTH.11 | HIBP (leaked password check) | — | painel Cloud → Auth Settings | switch ativo | P1 | `auth-config.security.test.ts` (não verificável via repo — TODO no painel) |
| AUTH.12 | Storage do JWT no cliente | — | inspeção do `supabase` client | `storage: localStorage` (default) — XSS-sensível | 🟡 P2 | `auth-storage.security.test.ts` |

### Gap conhecido — AUTH.12

`localStorage` é vulnerável a XSS. Não migramos para httpOnly cookies porque o app é SPA e o Supabase JS SDK não suporta nativamente. Mitigação: CSP estrita (A.4) + nenhuma fonte de XSS (sem `dangerouslySetInnerHTML`, sem `eval`, sem injeção de HTML user-provided — validado em `xss-surface.security.test.ts`).

---

## B.2 Autorização (RLS, IDOR, escopo)

| ID | Cenário | Pré-condição | Passos | Resultado esperado | Severidade | Teste automatizado |
|----|---------|--------------|--------|--------------------|------------|--------------------|
| AUTHZ.1 | Anon não lê tabelas privadas | — | client com chave anon faz `select` em todas as tabelas | erro RLS ou `[]` | P0 | `rls-anon.security.test.ts` ✅ |
| AUTHZ.2 | Anon não insere | — | insert anon | erro RLS | P0 | `rls-anon.security.test.ts` ✅ |
| AUTHZ.3 | Usuário A não lê transações de B | 2 usuários | A logado faz `select` filtrando por user_id=B | retorna `[]` (RLS força `auth.uid() = user_id`) | P0 | `cross-user.security.test.ts` (e2e) |
| AUTHZ.4 | Usuário A não consegue update em recursos de B | 2 usuários | A faz `update` em `category_budgets` por id de B | `error` ou 0 linhas afetadas | P0 | `cross-user.security.test.ts` (e2e) |
| AUTHZ.5 | Usuário A não consegue delete em recursos de B | 2 usuários | A faz `delete` em `pluggy_items.id` de B | 0 linhas afetadas | P0 | `cross-user.security.test.ts` (e2e) |
| AUTHZ.6 | IDOR em `pluggy-delete-item`: A não pode passar `itemId` de B | 2 usuários, B tem item | A chama edge function com `itemId` de B | 404 `not_found` | P0 | `cross-user.security.test.ts` (e2e) |
| AUTHZ.7 | IDOR em `account-export`: só exporta dados do próprio JWT | — | A chama com seu JWT | export contém apenas linhas onde user_id=A | P0 | code review + `account-export` filtra `eq("user_id", userId)` |
| AUTHZ.8 | Função `pluggy_categories` é leitura-pública apenas autenticada | — | anon select | erro ou `[]` | P2 | `rls-anon.security.test.ts` ✅ |
| AUTHZ.9 | Sem roles administrativas no app | — | grep `is_admin`, `role = 'admin'` | nenhum match | P1 | `roles-isolation.security.test.ts` |
| AUTHZ.10 | Enumeração de IDs (UUID v4) — risco baixo | — | UUIDs gerados via `gen_random_uuid()` | não-sequenciais | P3 | review schema |

---

## B.3 API / Edge functions

| ID | Cenário | Severidade | Teste automatizado |
|----|---------|------------|--------------------|
| API.1 | Toda edge function valida JWT (`config.toml` `verify_jwt = true`) | P0 | `auth-config.security.test.ts` ✅ |
| API.2 | Validação de input: itemId é string trim + non-empty | P1 | `edge-input-validation.security.test.ts` (grep) |
| API.3 | Erros não vazam stack/SQL/payload upstream | P0 | `errors.ts` usa `SAFE_MESSAGE`; teste `error-leak.security.test.ts` confirma que respostas só contêm `error` + `message` curtos |
| API.4 | CORS: preflight de origin não-allowlistada **não** retorna `Allow-Origin` | P0 | `cors.security.test.ts` ✅ + `edge-functions.security.test.ts` (e2e) |
| API.5 | Sem endpoints arbitrários SQL (`execute_sql`/`rpc('execute_sql')`) | P0 | `sql-injection.security.test.ts` (grep) |
| API.6 | Rate limit aplicado pelo gateway Supabase (default 100 req/s por IP) | P2 | manual; documentado |
| API.7 | Mass assignment: edge functions só persistem campos validados | P1 | code review (sync-data faz mapping campo a campo) |
| API.8 | Replay/idempotência em sync: `upsert(onConflict)` evita duplicatas | P1 | code review `pluggy-sync-data` usa upsert por `pluggy_transaction_id` |
| API.9 | Webhooks (cron): protegido por `X-Cron-Secret` (CRON_SHARED_SECRET) | P0 | code review + `cron-secret.security.test.ts` (grep que sync-data exige header ou JWT) |
| API.10 | Service-role key nunca em código client | P0 | `secrets-leak.security.test.ts` ✅ |

---

## B.4 Sessões, tokens e secrets

| ID | Cenário | Severidade | Teste |
|----|---------|------------|-------|
| TOK.1 | Nenhum segredo de servidor no bundle (service role, Pluggy secret, cron) | P0 | `secrets-leak.security.test.ts` ✅ |
| TOK.2 | Nenhuma URL HTTP externa | P1 | `https-only.security.test.ts` ✅ |
| TOK.3 | Logs sem PII/CPF/token/senha | P1 | `log-pii.security.test.ts` ✅ |
| TOK.4 | `localStorage` só armazena sessão Supabase (sem CPF/saldo) | P1 | `auth-storage.security.test.ts` |
| TOK.5 | Sem credenciais hardcoded (Bearer/AWS keys) | P0 | `secrets-leak.security.test.ts` ✅ |
| TOK.6 | Secrets segregados por ambiente (dev != prod) | P2 | manual: Lovable Cloud usa um único projeto Supabase em prod, secrets gerenciados via painel |

---

## B.5 Banco de dados, storage e vazamento

| ID | Cenário | Severidade | Teste |
|----|---------|------------|-------|
| DB.1 | RLS habilitado em **todas** as tabelas privadas | P0 | `rls-coverage.security.test.ts` (lê schema, valida políticas) |
| DB.2 | `app_settings` é deny-all (somente service role) | P0 | `rls-anon.security.test.ts` ✅ |
| DB.3 | `audit_log` é insert/select próprio + sem update/delete | P1 | inspeção schema ✅ |
| DB.4 | Sem buckets de storage públicos | P0 | tool `supabase--read_query` lista `storage.buckets` — atualmente **nenhum bucket** existe |
| DB.5 | Função `lgpd_data_retention_cleanup` apaga >24m e items mortos >90d | P1 | code review |
| DB.6 | `account-export` retorna apenas tabelas do próprio user_id | P0 | code review |
| DB.7 | Backups: gerenciados pelo Lovable Cloud, sem download manual no app | P2 | documentado |
| DB.8 | `pii-leak.security.test.ts`: respostas das edge functions não devolvem `tax_number`, `card_number_last4`, `bank_password` desnecessariamente | P1 | grep responses + manual |

---

## B.6 Open Finance (Pluggy)

| ID | Cenário | Severidade | Teste |
|----|---------|------------|-------|
| OF.1 | Sem coleta manual de senha bancária no app | P0 | `no-bank-credentials.security.test.ts` ✅ |
| OF.2 | Apenas Pluggy é provedor (sem Belvo/Plaid/etc.) | P1 | idem ✅ |
| OF.3 | Read-only: nenhuma chamada a `/payments`, `/transfers`, `/pix`, `/boletos` | P0 | `read-only-pluggy.security.test.ts` ✅ |
| OF.4 | Consentimento explícito antes de conectar (`ConsentGate`) | P1 | `lgpd.security.test.ts` ✅ |
| OF.5 | Revogação: `pluggy-delete-item` chama `DELETE /items/{id}` antes do purge local | P1 | `lgpd.security.test.ts` ✅ |
| OF.6 | Expiração: `pluggy-list-items` expõe `status=LOGIN_ERROR` ao usuário; cleanup remove >90d | P2 | code review |
| OF.7 | Escopos mínimos: `pluggy-connect-token` não pede escopos extra | P1 | code review |

## B.7 Stripe

Pagamento ainda não implementado. Quando entrar:
- nenhum input de cartão no app (PCI scope = SAQ-A);
- webhook validado por assinatura (`Stripe-Signature`);
- idempotência por `event.id`;
- atualização de plano só via webhook server-side, nunca via frontend.

Checklist será adicionado em `docs/security/STRIPE.md` no momento do enable.

---

## C. Regressão funcional

Toda mudança de segurança roda a suíte completa antes do merge:

| Fluxo | Cobertura atual |
|-------|-----------------|
| Cadastro / Login / Logout | `auth-flows.security.test.ts` (e2e) + `protected-route.regression.test.tsx` |
| Dashboard / Extrato unificado | manual + smoke `App.tsx` route registration |
| Categorização / Categorização pendente | manual |
| Faturas / Ciclo financeiro | `cycle.regression.test.ts`, `cardCycle.regression.test.ts`, `billPayment.test.ts` |
| Configurações / Conexões / Planos | manual |
| Sincronização Pluggy | `cron-secret.security.test.ts` (grep) + `read-only-pluggy.security.test.ts` |
| Exportação | code review `account-export` |
| Filtros / edição / regras automáticas | manual |

---

## Como rodar

```bash
# Suíte rápida (sem rede, sem auth real) — roda no CI sempre:
bunx vitest run src/test

# Suíte completa incluindo cenários e2e que criam usuários sintéticos:
SECURITY_E2E=1 bunx vitest run src/test/security
```

Os testes `e2e` criam contas `nivra-sec-<rand>@example.test`, executam as
verificações cross-user, e as removem chamando `account-delete` no teardown.
Se o teardown falhar (rede/edge fora), as contas órfãs são limpas pelo
`lgpd_data_retention_cleanup` em ≤90 dias.