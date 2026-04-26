
# 🔒 Diagnóstico técnico e plano de hardening de segurança

Atuei como engenheiro sênior em segurança e revisei arquitetura, edge functions, RLS, migrations, fluxo Pluggy, autenticação e tratamento de dados sensíveis. O resultado abaixo mapeia **cada promessa pública do produto → estado atual → ação corretiva**, e em seguida lista o plano de implementação concreto (tudo o que mexe em código/infra é executado quando o plano for aprovado).

---

## 📊 Matriz de aderência (estado ATUAL antes das correções)

| Promessa pública | Aderência | Evidência |
|---|---|---|
| **Open Finance regulado (Pluggy)** | 🟢 Alta | Toda conexão usa Pluggy Connect Widget (OAuth-like). Nenhum input manual de credencial bancária no código. `pluggy-connect-token` cria token efêmero sempre com `clientUserId = auth.uid()`. |
| **Sem coleta de senhas bancárias** | 🟢 Alta | Confirmado: nenhum campo de senha bancária na UI, nenhum payload com senha, nenhuma coluna `password/token/credential` nas tabelas Pluggy. Apenas senha do **app Nivra** (gerenciada por Supabase Auth, hash bcrypt). |
| **Read-only nas contas conectadas** | 🟢 Alta | Pluggy Brasil opera como **AISP** (read-only) — não existem endpoints de iniciação de pagamento no código. Nenhuma chamada a `/payments`, `/transfers`, `/pix` na Pluggy. |
| **Criptografia em trânsito** | 🟢 Alta | Supabase + Lovable forçam HTTPS/TLS 1.2+. Pluggy idem. Sem fallback HTTP. |
| **Criptografia em repouso** | 🟢 Alta | Postgres do Supabase usa AES-256 at-rest por padrão; backups idem. |
| **Hospedagem no Brasil** | 🟡 Parcial | Supabase suporta `sa-east-1` (São Paulo) — **precisa ser verificado em produção** via `cloud_status` / configuração do projeto. Edge Functions Deno rodam globalmente (multi-região); isso precisa ser comunicado com transparência. |
| **LGPD — exclusão de dados** | 🔴 Ausente | **Não existe fluxo de "Excluir minha conta"** que apague dados do usuário em cascata. |
| **LGPD — política de retenção** | 🔴 Ausente | Sem job de limpeza de itens revogados ou logs antigos. |
| **LGPD — exportação de dados** | 🔴 Ausente | Não há endpoint para o usuário baixar seus dados. |
| **LGPD — trilha de auditoria** | 🔴 Ausente | Sem `audit_log` para acessos sensíveis. |
| **Autorização edge functions** | 🔴 Crítico | `pluggy-sync-data` aceita `source: "cron"` do body e contorna validação JWT (auth bypass). Mesmo com JWT inválido cai no caminho admin. |
| **Service role key gerenciado** | 🔴 Crítico | `pluggy-sync-data` faz "self-heal" gravando `SUPABASE_SERVICE_ROLE_KEY` em **plaintext** na tabela `app_settings`. Backup vaza a chave mestra. |
| **Vazamento de info em erros** | 🟡 Parcial | Múltiplas edge functions retornam `details: <db_error.message | pluggy_payload>` para o cliente, expondo schema interno. |
| **RLS** | 🟢 Alta | Todas as tabelas com dados de usuário têm policies `auth.uid() = user_id`. |
| **Realtime channel auth** | 🟡 Parcial | Sem policy em `realtime.messages` (qualquer authenticated assina qualquer canal). |
| **`raw_payload` em transações** | 🟡 Parcial | Armazenamos o JSON bruto da Pluggy. Nenhum dado de credencial está lá (Pluggy não retorna senha), mas contém merchant, número parcial de cartão, etc. — coberto por RLS, ok mas vamos auditar e limitar. |
| **Rate limiting / brute force** | 🟡 Parcial | Supabase Auth já protege login. Edge functions próprias **não** têm rate limit — atacante pode martelar `pluggy-sync-data`. |
| **HIBP (senhas vazadas)** | 🔴 Não habilitado | Nenhuma proteção contra senhas conhecidamente vazadas no signup. |
| **Headers de segurança / CORS** | 🟡 Parcial | CORS está como `Access-Control-Allow-Origin: *` em todas as edge functions. Aceitável para API pública autenticada por JWT, mas vamos restringir para domínios conhecidos. |

---

## 🎯 Plano de correção (será executado após aprovação)

### **FASE 1 — Tapar buracos críticos (P0, fazer primeiro)**

#### 1.1 Corrigir auth bypass em `pluggy-sync-data`
- Remover **completamente** o branch `source: "cron"` do body.
- Sempre exigir JWT válido. Se inválido → retornar `401` imediatamente (sem fallback silencioso).
- Para o cron interno, usar um header dedicado `X-Cron-Secret` validado contra um **novo secret** `CRON_SHARED_SECRET` (gerado e armazenado em Supabase Secrets, nunca em DB). Se vier esse header e bater, pula JWT e usa service role.
- Atualizar a função SQL `trigger_pluggy_sync_all` para enviar o header `X-Cron-Secret` em vez do `Authorization: Bearer <service_key>`.

#### 1.2 Eliminar service role key persistido em DB
- Remover o bloco "self-heal" de `pluggy-sync-data` que escrevia em `app_settings.service_key`.
- Remover a linha `service_key` da tabela `app_settings` via migration (`DELETE`).
- Migration adicional: revogar `service_key` da função `trigger_pluggy_sync_all` — passa a usar `current_setting('app.settings.cron_secret', true)` lendo de **Vault**, não de tabela.
- Alternativa mais simples e segura: a função `trigger_pluggy_sync_all` lê o secret de `vault.secrets` (Supabase Vault) em vez de `app_settings`.

#### 1.3 Sanitizar respostas de erro
- Criar helper `supabase/functions/_shared/errors.ts` que retorna `{ error: "<machine_code>", message: "<safe_human_msg>" }` para o cliente, e loga o detalhe interno só em `console.error`.
- Aplicar em: `pluggy-sync-data`, `pluggy-register-item`, `pluggy-list-items`, `pluggy-connect-token`, `pluggy-delete-item`, `pluggy-sync-categories`.

#### 1.4 Fechar realtime
- Migration adicionando RLS policy em `realtime.messages` que permite `SELECT` apenas em tópicos cujo nome bate com o `auth.uid()` do assinante (padrão `private:user:<uid>:*`).
- Auditar `category_budgets` (única tabela publicada em realtime hoje, segundo o linter) — confirmar se é realmente necessária. Se não, despublicar.

---

### **FASE 2 — Conformidade LGPD (P1)**

#### 2.1 Direito ao esquecimento (exclusão de conta)
- Nova edge function `account-delete` (verify_jwt=true) que:
  1. Valida JWT.
  2. Para cada `pluggy_items` do usuário, chama `DELETE /items/{id}` na Pluggy (revoga consentimento upstream).
  3. Apaga em cascata: `pluggy_transactions`, `pluggy_bills`, `pluggy_accounts`, `pluggy_items`, `category_budgets`, `total_budget_settings`, `card_cycle_settings`, `profiles`.
  4. Chama `supabase.auth.admin.deleteUser(userId)` via service role.
  5. Retorna `204`.
- Nova UI em **Configurações → Privacidade e dados** com:
  - Botão "Exportar meus dados" (JSON download).
  - Botão "Excluir minha conta" com confirmação dupla (digite o e-mail).

#### 2.2 Exportação de dados (portabilidade LGPD Art. 18)
- Nova edge function `account-export` (verify_jwt=true) que coleta todas as tabelas do usuário e devolve um JSON estruturado com `Content-Disposition: attachment`.

#### 2.3 Retenção e limpeza automática
- Migration: novo cron job semanal `cleanup_orphan_data` que:
  - Apaga `pluggy_transactions` com `transaction_date < now() - interval '24 months'` (limite legal típico para extratos).
  - Apaga `pluggy_items` com status `LOGIN_ERROR` há mais de 90 dias (consentimento expirado/revogado e usuário não reativou).
  - Logs em uma nova tabela `audit_log` (tipo: `data_retention`).

#### 2.4 Trilha de auditoria mínima
- Nova tabela `audit_log` (RLS: usuário lê só os próprios eventos):
  ```
  id, user_id, event_type, event_details jsonb, ip_address inet, user_agent text, created_at
  ```
- Eventos registrados:
  - `auth.login`, `auth.logout`, `auth.password_reset`
  - `pluggy.item_connected`, `pluggy.item_disconnected`, `pluggy.sync_executed`
  - `account.exported`, `account.deleted`
- UI em **Configurações → Atividade da conta** mostrando histórico ao usuário (transparência LGPD).

#### 2.5 Página de Política de Privacidade e Termos
- Nova rota `/privacidade` e `/termos` com texto base cobrindo:
  - Bases legais (consentimento + execução de contrato).
  - Quais dados são coletados, finalidade, retenção.
  - Direitos do titular + como exercê-los (link direto para export/delete).
  - DPO contato (placeholder para o usuário preencher).
  - Sub-processadores: Supabase, Pluggy, Lovable.

#### 2.6 Banner de consentimento explícito
- Modal **uma única vez** no primeiro acesso pós-signup pedindo consentimento expresso para:
  - Coleta de dados financeiros via Open Finance.
  - Tratamento conforme Política de Privacidade.
- Persistido em `profiles.consent_accepted_at` (nova coluna timestamptz).

---

### **FASE 3 — Hardening transversal (P2)**

#### 3.1 Rate limiting nas edge functions
- Implementar rate limit simples em DB (tabela `rate_limit_buckets`) para `pluggy-sync-data` e `pluggy-connect-token`:
  - Máx 10 chamadas/minuto por user_id.
  - Máx 60 chamadas/hora por user_id.
- Retorna `429` com `Retry-After`.

#### 3.2 HIBP (Have I Been Pwned) no signup
- Habilitar `password_hibp_enabled` via tool `configure_auth`.
- Aumentar mínimo de senha para 10 caracteres.

#### 3.3 CORS restrito
- Trocar `Access-Control-Allow-Origin: *` por allowlist:
  - `https://nivra-financial-clarity.lovable.app`
  - `https://*.lovable.app` (preview)
  - Domínio custom quando aplicável.
- Implementar via helper `_shared/cors.ts` que checa `Origin` recebido.

#### 3.4 Logs sem PII
- Auditar todos `console.log/error` das edge functions: nada de email, CPF, descrição de transação, merchant ou amount.
- Logs passam a usar IDs internos (`user_id`, `item_id`) — consultáveis cruzando com a DB.

#### 3.5 Headers de segurança
- Adicionar via `index.html` / Lovable hosting:
  - `Content-Security-Policy` (whitelist Supabase + Pluggy + self).
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
  - `X-Content-Type-Options: nosniff`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy` (desabilita camera/mic/geo).

#### 3.6 Auditoria do `raw_payload`
- Confirmar via SQL que nenhum campo de `raw_payload` em `pluggy_transactions/accounts/bills` contém credencial. (Pluggy nunca retorna senha — apenas dados de conta/transação. RLS já protege).
- Documentar no código que `raw_payload` é mantido por **debug e backwards-compat**, e adicionar TODO de migration futura para droppá-lo se nunca usado em queries.

---

### **FASE 4 — Validação e evidências (entregáveis para o time de compliance)**

Vou gerar como **artefatos em `/mnt/documents/`** após implementação:

1. **`security-compliance-report.md`** — diagnóstico final com matriz promessa→evidência→teste, severidade, status pós-fix.
2. **`security-checklist-release.md`** — checklist operacional para uso em cada release futura (qualquer mudança em edge function, schema ou auth precisa passar nesse checklist).
3. **`lgpd-data-flow.md`** — mapa de fluxo de dados (o que entra, onde fica, quanto tempo, como sai), bases legais por dado.
4. **`open-finance-validation.md`** — evidências de read-only, escopos, fluxo de consentimento, expiração e revogação.
5. **`hosting-region-evidence.md`** — onde cada componente roda (Supabase região + Edge Functions + ferramentas auxiliares), com recomendação de mudança caso necessário.
6. **`tests/security.test.ts`** — testes automatizados Vitest cobrindo:
   - JWT inválido em todas as edge functions retorna 401.
   - `source: "cron"` no body sem `X-Cron-Secret` retorna 401.
   - Tentativa de cross-tenant (usar `itemId` de outro user) retorna 403/404.
   - Resposta de erro **nunca** contém substrings tipo "supabase", "postgres", "duplicate key".
   - CORS rejeita origin não-permitido.

---

## ⚠️ Pontos que precisam de decisão sua antes de eu prosseguir

1. **Região do Supabase**: o projeto atual está hospedado onde? Se não estiver em `sa-east-1` (São Paulo), precisamos:
   - **Opção A:** Migrar (envolve criar projeto novo + dump/restore — não-trivial).
   - **Opção B:** Ajustar a comunicação pública para refletir a realidade (ex.: "infra na América do Sul" em vez de "Brasil") até que migração seja feita.
   - Posso checar com `cloud_status` durante a execução.

2. **Edge Functions globais**: rodam em edge global (não só Brasil). Para promessa estrita "tudo no Brasil" precisaríamos arquitetura diferente. Sugiro disclaimer transparente no Termo: *"dados em repouso no Brasil; processamento em edge multi-região com baixa latência, sem retenção"*.

3. **Cron secret**: posso gerar e cadastrar via `add_secret` o `CRON_SHARED_SECRET` (32 bytes random hex) na Fase 1.

4. **Política de Privacidade**: vou criar template padrão LGPD-compliant; você revisa e preenche dados do controlador (CNPJ, DPO).

---

## 🚀 Ordem de execução proposta

Após aprovação, executo nesta sequência (em commits/migrations isolados, fácil de auditar):

1. ✅ **P0**: Correção do auth bypass + remoção do service key da DB + sanitização de erros + RLS realtime *(fase 1, ~5 arquivos)*.
2. ✅ **LGPD**: Edge functions `account-delete` + `account-export` + tabela `audit_log` + UI Configurações *(fase 2, ~8 arquivos + 2 migrations)*.
3. ✅ **Hardening**: Rate limit + HIBP + CORS allowlist + headers + logs sem PII *(fase 3, ~6 arquivos + 1 migration)*.
4. ✅ **Evidências**: Geração de todos os relatórios `.md` em `/mnt/documents/` + suite de testes em `src/test/security.test.ts` rodando verde.

Estimativa total: **~20 arquivos modificados/criados, 3-4 migrations**, totalmente reversível por commit.

Aprove o plano para eu iniciar pela Fase 1 (P0).
