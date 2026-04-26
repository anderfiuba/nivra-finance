import { corsHeaders } from "../_shared/cors.ts";
import { pluggyFetch } from "../_shared/pluggy.ts";
import { errorResponse } from "../_shared/errors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Sincroniza accounts + transactions + bills + categorias de um item Pluggy.
//
// Esta implementação respeita ESTRITAMENTE o que a documentação oficial entrega:
//   - amount: já vem com sinal correto (cartão: + = gasto, − = pagamento;
//     conta corrente: o type DEBIT/CREDIT acompanha o sinal). NÃO invertemos.
//   - balance de cartão (CREDIT): valor da fatura aberta (positivo na API).
//     Não alteramos aqui — a UI trata como dívida ao consolidar saldo.
//   - amountInAccountCurrency: valor convertido na moeda da conta (BRL),
//     usado para somatórios quando a transação é internacional.
//   - category: rótulo nativo do categorizador da Pluggy. Persistido em
//     category_pluggy. O campo `category` permanece reservado para o override
//     manual feito pelo usuário.
//
// Segurança (HARDENED — pós-auditoria):
//   1. Dois caminhos mutuamente exclusivos de autenticação:
//      a) Caller cron: header `X-Cron-Secret` = CRON_SHARED_SECRET (Vault).
//         Não exige JWT. Resolve user_id do item via service role.
//      b) Caller usuário: JWT válido. Posse do item via RLS.
//      JWT inválido OU secret errado → 401 imediato. ELIMINADO o bypass
//      anterior `source: "cron"` no body.
//   2. NUNCA persistimos SUPABASE_SERVICE_ROLE_KEY no banco. Cron usa
//      shared secret dedicado e rotacionável.
//   3. Erros internos só em console.error; cliente recebe códigos curtos
//      via _shared/errors.ts.

interface PluggyAccount {
  id: string;
  itemId: string;
  name: string;
  marketingName?: string | null;
  type?: string | null;
  subtype?: string | null;
  balance: number;
  currencyCode?: string | null;
  owner?: string | null;
  taxNumber?: string | null;
  number?: string | null;
  bankData?: {
    transferNumber?: string | null;
    closingBalance?: number | null;
    automaticallyInvestedBalance?: number | null;
    overdraftContractedLimit?: number | null;
    overdraftUsedLimit?: number | null;
  } | null;
  creditData?: {
    level?: string | null;
    brand?: string | null;
    balanceCloseDate?: string | null;
    balanceDueDate?: string | null;
    availableCreditLimit?: number | null;
    creditLimit?: number | null;
    minimumPayment?: number | null;
    status?: string | null;
  } | null;
}

interface PluggyTransaction {
  id: string;
  accountId: string;
  description: string;
  descriptionRaw?: string | null;
  amount: number;
  amountInAccountCurrency?: number | null;
  currencyCode?: string | null;
  date: string;
  category?: string | null;
  categoryId?: string | null;
  paymentData?: { paymentMethod?: string | null } | null;
  type?: string | null;
  status?: string | null;
  operationType?: string | null;
  merchant?: { name?: string | null } | null;
  creditCardMetadata?: {
    installmentNumber?: number | null;
    totalInstallments?: number | null;
  } | null;
}

interface PluggyBill {
  id: string;
  dueDate?: string | null;
  totalAmount?: number | null;
  totalAmountCurrencyCode?: string | null;
  minimumPaymentAmount?: number | null;
  allowsInstallments?: boolean | null;
  payments?: unknown;
}

const PAGE_SIZE = 500;

async function fetchAllTransactions(accountId: string): Promise<PluggyTransaction[]> {
  const all: PluggyTransaction[] = [];
  let page = 1;
  // Pega últimos 12 meses (Pluggy permite até 12m por padrão na produção).
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 12);
  from.setDate(from.getDate() - 1); // pequena margem
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  while (true) {
    const url = `/transactions?accountId=${encodeURIComponent(accountId)}&from=${fromStr}&to=${toStr}&pageSize=${PAGE_SIZE}&page=${page}`;
    const res = await pluggyFetch(url, { method: "GET" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Pluggy /transactions falhou [${res.status}]: ${body}`);
    }
    const data = (await res.json()) as { results: PluggyTransaction[]; total: number; totalPages: number };
    all.push(...(data.results ?? []));
    if (page >= (data.totalPages ?? 1)) break;
    page += 1;
    if (page > 60) break; // safety — 60 páginas × 500 = 30k tx para 12 meses
  }
  return all;
}

async function fetchAllBills(accountId: string): Promise<PluggyBill[]> {
  const all: PluggyBill[] = [];
  let page = 1;
  while (true) {
    const url = `/bills?accountId=${encodeURIComponent(accountId)}&pageSize=200&page=${page}`;
    const res = await pluggyFetch(url, { method: "GET" });
    if (!res.ok) {
      // /bills só existe pra cartões em alguns conectores. Não derruba o sync.
      const body = await res.text();
      console.warn("pluggy /bills falhou", res.status, body);
      return all;
    }
    const data = (await res.json()) as { results?: PluggyBill[]; totalPages?: number };
    all.push(...(data.results ?? []));
    if (page >= (data.totalPages ?? 1)) break;
    page += 1;
    if (page > 10) break;
  }
  return all;
}

// deno-lint-ignore no-explicit-any
async function syncCategoriesCatalog(adminClient: any): Promise<void> {
  // Catálogo é global — só repopulamos se a tabela estiver vazia ou desatualizada (>7 dias).
  const { data: existing } = await adminClient
    .from("pluggy_categories")
    .select("id, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  const lastUpdated = existing && existing.length > 0
    ? String(existing[0].updated_at ?? "")
    : "";
  const fresh = lastUpdated.length > 0
    && Date.now() - new Date(lastUpdated).getTime() < 7 * 24 * 60 * 60 * 1000;
  if (fresh) return;

  try {
    let page = 1;
    const all: Array<{ id: string; description: string; descriptionTranslated?: string | null; parentId?: string | null; parentDescription?: string | null }> = [];
    while (true) {
      const res = await pluggyFetch(`/categories?pageSize=500&page=${page}`, { method: "GET" });
      if (!res.ok) {
        console.warn("pluggy /categories falhou", res.status);
        return;
      }
      const data = await res.json() as { results?: typeof all; totalPages?: number };
      all.push(...(data.results ?? []));
      if (page >= (data.totalPages ?? 1)) break;
      page += 1;
      if (page > 10) break;
    }
    if (all.length === 0) return;
    const rows = all.map((c) => ({
      id: c.id,
      description: c.description,
      description_translated: c.descriptionTranslated ?? null,
      parent_id: c.parentId ?? null,
      parent_description: c.parentDescription ?? null,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await adminClient.from("pluggy_categories").upsert(rows, { onConflict: "id" });
    if (error) console.error("upsert categories failed", error);
  } catch (err) {
    console.warn("syncCategoriesCatalog erro", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("method_not_allowed");
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { itemId?: string };
    if (!body.itemId) {
      return errorResponse("bad_request", { message: "itemId é obrigatório." });
    }

    // Cliente service role para upsert + ler settings.
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ===== Autenticação (caminhos mutuamente exclusivos) =====
    const cronSecretHeader = req.headers.get("X-Cron-Secret");
    const cronSecretEnv = Deno.env.get("CRON_SHARED_SECRET");
    const isCronCall =
      typeof cronSecretHeader === "string"
      && cronSecretHeader.length > 0
      && typeof cronSecretEnv === "string"
      && cronSecretEnv.length > 0
      && cronSecretHeader === cronSecretEnv;

    let userId: string | null = null;

    if (isCronCall) {
      // Cron interno: resolve user_id do item via service role.
      const { data: itemRow, error: itemRowErr } = await adminClient
        .from("pluggy_items")
        .select("user_id")
        .eq("pluggy_item_id", body.itemId)
        .maybeSingle();
      if (itemRowErr || !itemRow) {
        return errorResponse("not_found", {
          logContext: "cron sync: item not found",
          logDetails: { itemId: body.itemId, err: itemRowErr?.message },
        });
      }
      userId = itemRow.user_id as string;
    } else {
      // Caller usuário: exige JWT válido. Sem fallback.
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return errorResponse("unauthorized");
      }
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData.user) {
        return errorResponse("unauthorized", {
          logContext: "user JWT inválido",
          logDetails: userError?.message,
        });
      }
      userId = userData.user.id;
      // Posse do item via RLS — bloqueia cross-tenant.
      const { data: ownItem } = await userClient
        .from("pluggy_items")
        .select("pluggy_item_id")
        .eq("pluggy_item_id", body.itemId)
        .maybeSingle();
      if (!ownItem) {
        return errorResponse("forbidden", {
          logContext: "user tentou acessar item de outro user",
          logDetails: { userId, itemId: body.itemId },
        });
      }
    }

    // 1. Atualiza status do item
    const itemRes = await pluggyFetch(`/items/${encodeURIComponent(body.itemId)}`, {
      method: "GET",
    });
    const itemData = await itemRes.json();
    if (!itemRes.ok) {
      return errorResponse("upstream_error", {
        logContext: "pluggy /items fetch failed",
        logDetails: { status: itemRes.status, body: itemData },
      });
    }

    // 2. Busca accounts
    const accRes = await pluggyFetch(`/accounts?itemId=${encodeURIComponent(body.itemId)}`, {
      method: "GET",
    });
    const accJson = await accRes.json();
    if (!accRes.ok) {
      return errorResponse("upstream_error", {
        logContext: "pluggy /accounts fetch failed",
        logDetails: { status: accRes.status, body: accJson },
      });
    }
    const accounts: PluggyAccount[] = accJson.results ?? [];

    // Sincroniza catálogo de categorias (cache de 7d).
    await syncCategoriesCatalog(adminClient);

    // Upsert accounts
    if (accounts.length > 0) {
      const accountRows = accounts.map((a) => {
        const isCredit = (a.type ?? "").toUpperCase() === "CREDIT";
        const cd = a.creditData ?? null;
        const bd = a.bankData ?? null;
        return {
          user_id: userId,
          pluggy_account_id: a.id,
          pluggy_item_id: body.itemId!,
          name: a.name,
          marketing_name: a.marketingName ?? null,
          type: a.type ?? null,
          subtype: a.subtype ?? null,
          // Persistimos o balance EXATAMENTE como vem da Pluggy.
          // Para CREDIT, isto é a fatura aberta (positivo na API).
          // A camada de leitura (FinanceContext) trata como dívida.
          balance: typeof a.balance === "number" ? a.balance : 0,
          currency: a.currencyCode ?? "BRL",
          owner: a.owner ?? null,
          tax_number: a.taxNumber ?? null,
          // Credit data
          credit_limit: isCredit ? (cd?.creditLimit ?? null) : null,
          available_credit_limit: isCredit ? (cd?.availableCreditLimit ?? null) : null,
          balance_due_date: isCredit ? (cd?.balanceDueDate ?? null) : null,
          balance_close_date: isCredit ? (cd?.balanceCloseDate ?? null) : null,
          minimum_payment: isCredit ? (cd?.minimumPayment ?? null) : null,
          card_brand: isCredit ? (cd?.brand ?? null) : null,
          card_level: isCredit ? (cd?.level ?? null) : null,
          card_number_last4: isCredit ? (a.number ?? null) : null,
          // Bank data
          bank_overdraft_limit: !isCredit ? (bd?.overdraftContractedLimit ?? null) : null,
          bank_overdraft_used: !isCredit ? (bd?.overdraftUsedLimit ?? null) : null,
          automatically_invested_balance: !isCredit ? (bd?.automaticallyInvestedBalance ?? null) : null,
          raw_payload: a as unknown as Record<string, unknown>,
        };
      });
      const { error: accUpsertErr } = await adminClient
        .from("pluggy_accounts")
        .upsert(accountRows, { onConflict: "pluggy_account_id" });
      if (accUpsertErr) {
        return errorResponse("internal_error", {
          logContext: "db upsert accounts failed",
          logDetails: accUpsertErr.message,
        });
      }
    }

    // 3. Busca transações por conta
    let totalTx = 0;
    let totalBills = 0;
    let totalPaidInferred = 0;
    for (const acc of accounts) {
      const accCurrency = acc.currencyCode ?? "BRL";
      const txs = await fetchAllTransactions(acc.id);
      if (txs.length > 0) {
        const rows = txs.map((t) => {
          // Doc oficial: `amount` JÁ vem com sinal correto.
          // - Conta corrente: type DEBIT acompanha amount negativo, CREDIT positivo.
          // - Cartão: positivo = gasto (debit), negativo = pagamento (credit).
          // NÃO invertemos. Para o nosso modelo "entrada/saida" usamos:
          //   * entrada = amount > 0 numa conta BANK
          //   * saida   = amount < 0 numa conta BANK
          //   * No cartão (CREDIT account), invertemos APENAS na leitura para fins
          //     de exibição (gasto deve aparecer como saída).
          const amount = Number(t.amount) || 0;
          return {
            user_id: userId,
            pluggy_transaction_id: t.id,
            pluggy_account_id: t.accountId,
            pluggy_item_id: body.itemId!,
            description: t.description ?? t.descriptionRaw ?? "Sem descrição",
            amount,
            currency: t.currencyCode ?? accCurrency,
            account_currency: accCurrency,
            amount_in_account_currency: typeof t.amountInAccountCurrency === "number"
              ? t.amountInAccountCurrency
              : null,
            transaction_date: t.date,
            // category permanece null — é o override manual.
            // category_pluggy guarda o rótulo do categorizador da Pluggy.
            category_pluggy: t.category ?? null,
            category_id: t.categoryId ?? null,
            payment_method: t.paymentData?.paymentMethod ?? null,
            type: t.type ?? null,
            status: t.status ?? null,
            operation_type: t.operationType ?? null,
            merchant_name: t.merchant?.name ?? null,
            installment_number: t.creditCardMetadata?.installmentNumber ?? null,
            total_installments: t.creditCardMetadata?.totalInstallments ?? null,
            raw_payload: t as unknown as Record<string, unknown>,
          };
        });
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500);
          // upsert SEM sobrescrever a category manual: usamos default merge,
          // mas como nunca enviamos `category` na payload, o valor existente
          // permanece preservado nas colunas não-mencionadas APENAS se usarmos
          // ignoreDuplicates=false + onConflict: o postgrest faz UPDATE com
          // todas as colunas enviadas. Por isso `category` não está no objeto.
          // Para evitar reset acidental, fazemos UPSERT comum e depois um
          // UPDATE separado preservaria — mas como o objeto não inclui
          // `category`, o postgres mantém o valor anterior em UPDATE só se
          // a coluna não estiver no payload (que é nosso caso).
          const { error: txErr } = await adminClient
            .from("pluggy_transactions")
            .upsert(chunk, { onConflict: "pluggy_transaction_id" });
          if (txErr) {
            return errorResponse("internal_error", {
              logContext: "db upsert transactions failed",
              logDetails: txErr.message,
            });
          }
        }
        totalTx += rows.length;
      }

      // Bills: apenas cartões.
      if ((acc.type ?? "").toUpperCase() === "CREDIT") {
        const bills = await fetchAllBills(acc.id);
        if (bills.length > 0) {
          const billRows = bills.map((b) => ({
            user_id: userId,
            pluggy_bill_id: b.id,
            pluggy_account_id: acc.id,
            pluggy_item_id: body.itemId!,
            due_date: b.dueDate ? b.dueDate.slice(0, 10) : null,
            total_amount: b.totalAmount ?? null,
            total_amount_currency: b.totalAmountCurrencyCode ?? "BRL",
            minimum_payment_amount: b.minimumPaymentAmount ?? null,
            allows_installments: b.allowsInstallments ?? null,
            raw_payload: b as unknown as Record<string, unknown>,
          }));
          const { error: billErr } = await adminClient
            .from("pluggy_bills")
            .upsert(billRows, { onConflict: "pluggy_bill_id" });
          if (billErr) console.error("upsert pluggy_bills failed", billErr);
          else totalBills += billRows.length;

          // Inferência de pagamento: a Pluggy raramente atualiza paid=true.
          // Detecta pagamento da fatura como uma transação CREDIT na conta do
          // cartão (descrição com "pagamento") + valor próximo do total +
          // janela de [due-30d, due+15d]. Atualiza paid=true para essas bills.
          totalPaidInferred += await markPaidBillsByInference(adminClient, userId, acc.id, bills);
        }
      }
    }

    // 4. Atualiza status do item
    const statusDetail = (itemData as { statusDetail?: Record<string, unknown> | null })?.statusDetail ?? null;
    const lastSyncWarning = buildSyncWarning(statusDetail, accounts);
    await adminClient
      .from("pluggy_items")
      .update({
        status: itemData.status ?? null,
        execution_status: itemData.executionStatus ?? null,
        status_detail: statusDetail,
        last_sync_warning: lastSyncWarning,
        last_synced_at: new Date().toISOString(),
      })
      .eq("pluggy_item_id", body.itemId)
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({
        ok: true,
        accounts: accounts.length,
        transactions: totalTx,
        bills: totalBills,
        paidInferred: totalPaidInferred,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return errorResponse("internal_error", {
      logContext: "pluggy-sync-data exception",
      logDetails: err instanceof Error ? err.message : err,
    });
  }
});

// deno-lint-ignore no-explicit-any
async function markPaidBillsByInference(
  adminClient: any,
  userId: string,
  pluggyAccountId: string,
  bills: PluggyBill[],
): Promise<number> {
  // Pega transações CREDIT (entrada) com descrição de pagamento OU categoria
  // Pluggy "Credit card payment" (category_id = 05100000) dessa conta.
  const { data: txs, error } = await adminClient
    .from("pluggy_transactions")
    .select("amount, transaction_date, description, type, category_pluggy, category_id")
    .eq("user_id", userId)
    .eq("pluggy_account_id", pluggyAccountId)
    .eq("type", "CREDIT");
  if (error || !txs) return 0;

  const PAYMENT_RE = /pagamento\s*recebido|payment\s*received|fatura\s*paga|pagamento\s*de\s*fatura/i;
  const NON_PAYMENT_RE = /cr[eé]dito\s+de\s+parcelamento|estorno|cashback|reembolso|chargeback|ajuste/i;
  const candidates = (txs as Array<{
    amount: number | string;
    transaction_date: string;
    description: string;
    type: string | null;
    category_pluggy: string | null;
    category_id: string | null;
  }>).filter((t) => {
    const desc = t.description ?? "";
    if (NON_PAYMENT_RE.test(desc)) return false;
    if (t.category_pluggy === "Credit card payment") return true;
    if (t.category_id === "05100000") return true;
    return PAYMENT_RE.test(desc);
  }).map((t) => ({
    amount: Math.abs(Number(t.amount)),
    ts: new Date(t.transaction_date).getTime(),
    desc: t.description ?? "",
  }));

  const idsToMarkPaid: string[] = [];
  const DAY = 24 * 60 * 60 * 1000;
  for (const b of bills) {
    if (!b.dueDate || b.totalAmount == null) continue;
    const total = Number(b.totalAmount);
    if (!(total > 0)) continue;
    const tol = Math.max(1, total * 0.02);
    // Janela em UTC, do início do dia LO até o FIM do dia HI (23:59:59.999).
    const due = Date.parse(b.dueDate.slice(0, 10) + "T00:00:00.000Z");
    const lo = due - 35 * DAY;
    const hi = due + 45 * DAY + (DAY - 1);
    const match = candidates.some((c) => c.ts >= lo && c.ts <= hi && Math.abs(c.amount - total) <= tol);
    if (match) idsToMarkPaid.push(b.id);
  }
  if (idsToMarkPaid.length === 0) return 0;
  const { error: updErr } = await adminClient
    .from("pluggy_bills")
    .update({ paid: true })
    .in("pluggy_bill_id", idsToMarkPaid)
    .eq("user_id", userId);
  if (updErr) {
    console.error("markPaidBillsByInference update failed", updErr);
    return 0;
  }
  return idsToMarkPaid.length;
}