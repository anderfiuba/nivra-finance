import { corsHeaders } from "../_shared/cors.ts";
import { pluggyFetch } from "../_shared/pluggy.ts";
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
// Segurança:
//   1. Exige JWT (verify_jwt=true).
//   2. Confirma posse do item via RLS antes de qualquer fetch na Pluggy.
//   3. Faz upsert via service role SEMPRE marcando user_id = auth.uid().

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
  // Pega últimos 90 dias por padrão (Pluggy sandbox/produção)
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
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
    if (page > 20) break; // safety
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
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente do usuário (RLS) — usado apenas para validar posse.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as { itemId?: string };
    if (!body.itemId) {
      return new Response(JSON.stringify({ error: "itemId_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirma posse via RLS
    const { data: ownItem, error: ownErr } = await userClient
      .from("pluggy_items")
      .select("pluggy_item_id")
      .eq("pluggy_item_id", body.itemId)
      .maybeSingle();
    if (ownErr || !ownItem) {
      return new Response(JSON.stringify({ error: "item_not_found_or_forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Atualiza status do item
    const itemRes = await pluggyFetch(`/items/${encodeURIComponent(body.itemId)}`, {
      method: "GET",
    });
    const itemData = await itemRes.json();
    if (!itemRes.ok) {
      console.error("pluggy-sync-data item fetch error", itemRes.status, itemData);
      return new Response(
        JSON.stringify({ error: "pluggy_item_fetch_failed", details: itemData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Busca accounts
    const accRes = await pluggyFetch(`/accounts?itemId=${encodeURIComponent(body.itemId)}`, {
      method: "GET",
    });
    const accJson = await accRes.json();
    if (!accRes.ok) {
      console.error("pluggy-sync-data accounts error", accRes.status, accJson);
      return new Response(
        JSON.stringify({ error: "pluggy_accounts_fetch_failed", details: accJson }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const accounts: PluggyAccount[] = accJson.results ?? [];

    // Cliente service role para upsert (bypassa RLS, mas força user_id = userId).
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
        console.error("upsert pluggy_accounts failed", accUpsertErr);
        return new Response(
          JSON.stringify({ error: "db_accounts_upsert_failed", details: accUpsertErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 3. Busca transações por conta
    let totalTx = 0;
    let totalBills = 0;
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
            console.error("upsert pluggy_transactions failed", txErr);
            return new Response(
              JSON.stringify({ error: "db_tx_upsert_failed", details: txErr.message }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
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
        }
      }
    }

    // 4. Atualiza status do item
    await adminClient
      .from("pluggy_items")
      .update({
        status: itemData.status ?? null,
        execution_status: itemData.executionStatus ?? null,
        last_synced_at: new Date().toISOString(),
      })
      .eq("pluggy_item_id", body.itemId)
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({ ok: true, accounts: accounts.length, transactions: totalTx, bills: totalBills }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error("pluggy-sync-data exception", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});