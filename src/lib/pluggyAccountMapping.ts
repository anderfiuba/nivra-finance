// Espelho EXATO do mapeamento usado em supabase/functions/pluggy-sync-data/index.ts
// (linhas 297-333). Mantido em /src para podermos cobrir com testes unitários
// sem precisar bootstrappar Deno.
//
// REGRA DE OURO: este arquivo NÃO pode ter divergência com a edge function.
// Quando você alterar o mapeamento na edge, ESPELHE aqui — o teste de
// regressão garante que o contrato com a Pluggy continua íntegro.

export interface PluggyAccountInput {
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

export interface PluggyAccountRow {
  user_id: string;
  pluggy_account_id: string;
  pluggy_item_id: string;
  name: string;
  marketing_name: string | null;
  type: string | null;
  subtype: string | null;
  balance: number;
  currency: string;
  owner: string | null;
  tax_number: string | null;
  credit_limit: number | null;
  available_credit_limit: number | null;
  balance_due_date: string | null;
  balance_close_date: string | null;
  minimum_payment: number | null;
  card_brand: string | null;
  card_level: string | null;
  card_number_last4: string | null;
  bank_overdraft_limit: number | null;
  bank_overdraft_used: number | null;
  automatically_invested_balance: number | null;
}

export function mapPluggyAccountToRow(
  a: PluggyAccountInput,
  userId: string,
  itemId: string,
): PluggyAccountRow {
  const isCredit = (a.type ?? "").toUpperCase() === "CREDIT";
  const cd = a.creditData ?? null;
  const bd = a.bankData ?? null;
  return {
    user_id: userId,
    pluggy_account_id: a.id,
    pluggy_item_id: itemId,
    name: a.name,
    marketing_name: a.marketingName ?? null,
    type: a.type ?? null,
    subtype: a.subtype ?? null,
    balance: typeof a.balance === "number" ? a.balance : 0,
    currency: a.currencyCode ?? "BRL",
    owner: a.owner ?? null,
    tax_number: a.taxNumber ?? null,
    credit_limit: isCredit ? (cd?.creditLimit ?? null) : null,
    available_credit_limit: isCredit ? (cd?.availableCreditLimit ?? null) : null,
    balance_due_date: isCredit ? (cd?.balanceDueDate ?? null) : null,
    balance_close_date: isCredit ? (cd?.balanceCloseDate ?? null) : null,
    minimum_payment: isCredit ? (cd?.minimumPayment ?? null) : null,
    card_brand: isCredit ? (cd?.brand ?? null) : null,
    card_level: isCredit ? (cd?.level ?? null) : null,
    card_number_last4: isCredit ? (a.number ?? null) : null,
    bank_overdraft_limit: !isCredit ? (bd?.overdraftContractedLimit ?? null) : null,
    bank_overdraft_used: !isCredit ? (bd?.overdraftUsedLimit ?? null) : null,
    automatically_invested_balance: !isCredit ? (bd?.automaticallyInvestedBalance ?? null) : null,
  };
}