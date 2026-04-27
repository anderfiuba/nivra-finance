import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  CATEGORY_COLORS,
  PendingType,
  Transaction,
} from "@/data/mockData";
import {
  CycleRange,
  formatCycleLabel,
  getCycleRange,
  getPreviousCycleRange,
  isWithinCycle,
  lastNCycles,
  currentCycleBucket,
  type CycleBucket,
} from "@/lib/cycle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { inferBillPaid } from "@/lib/billPayment";
import { buildPatrimonyHistory } from "@/lib/patrimonyHistory";

const STORAGE_CYCLE = "nivra:cycleDay:v1";
// Sempre usa a data atual — sem mock.
const REFERENCE_DATE = new Date();

type CycleTotals = { entradas: number; saidas: number; saldo: number };

export interface FinanceAccount {
  id: string;
  /** ID na Pluggy (chave usada por bills/transactions). */
  pluggyAccountId: string;
  /** ID Pluggy do item (conector) ao qual a conta pertence. */
  pluggyItemId: string | null;
  name: string;
  marketingName: string | null;
  type: string | null;
  subtype: string | null;
  balance: number;
  // Para cartões de crédito
  creditLimit: number | null;
  availableCreditLimit: number | null;
  balanceDueDate: string | null;
  balanceCloseDate: string | null;
  minimumPayment: number | null;
  cardBrand: string | null;
  cardNumberLast4: string | null;
  currency: string;
  /** Saldo automaticamente investido (poupança/CDB do banco). */
  automaticallyInvestedBalance: number | null;
  /** Logo do conector (vinda de pluggy_items). */
  connectorImageUrl: string | null;
  /** Cor primária do conector (hex sem #). */
  connectorPrimaryColor: string | null;
  /** Nome do conector (banco). */
  connectorName: string | null;
  /** Última sincronização do item ao qual essa conta pertence. */
  lastSyncedAt: string | null;
}

export interface PluggyCategoryNode {
  id: string;
  description: string;
  descriptionTranslated: string | null;
  parentId: string | null;
  parentDescription: string | null;
}

export interface FinanceBill {
  id: string;
  pluggyBillId: string;
  pluggyAccountId: string;
  pluggyItemId: string;
  dueDate: string | null;
  totalAmount: number | null;
  totalAmountCurrency: string;
  minimumPaymentAmount: number | null;
  allowsInstallments: boolean | null;
  paid: boolean;
  /**
   * `paid` original da Pluggy OU inferência local (pagamento detectado nas
   * transações do mesmo cartão).
   */
  effectivePaid: boolean;
  /** True quando `effectivePaid` veio da inferência (não do Pluggy). */
  paidInferred: boolean;
}

export interface CategoryBudget {
  id: string;
  categoryLabel: string;
  monthlyLimit: number;
  alertThreshold: number;
  /** 'parent' = orçamento de categoria principal; 'child' = subcategoria. */
  scope: "parent" | "child";
  /** Nome da categoria pai quando scope='child'. */
  parentCategoryLabel: string | null;
}

export interface TotalBudget {
  id: string;
  monthlyLimit: number;
  alertThreshold: number;
}

export interface CardCycleSetting {
  pluggyAccountId: string;
  closingDay: number | null;
  dueDay: number | null;
}

export interface PluggyItemSummary {
  id: string;
  pluggyItemId: string;
  connectorName: string;
  connectorImageUrl: string | null;
  connectorPrimaryColor: string | null;
  status: string | null;
  lastSyncedAt: string | null;
  /** Número de contas vinculadas a este item. */
  accountCount: number;
}

export type BudgetStatus = "ok" | "alert" | "over";
export interface BudgetProgress {
  categoryLabel: string;
  spent: number;
  limit: number;
  threshold: number;
  ratio: number; // spent / limit
  status: BudgetStatus;
  budgetId: string;
  scope: "parent" | "child";
  parentCategoryLabel: string | null;
}

/** Agregação mensal hierárquica de despesas (pai → filhas). */
export interface CategoryMonthlyAgg {
  parentLabel: string;
  parentId: string | null;
  spent: number;
  pctOfTotal: number;
  children: { label: string; spent: number; pctOfParent: number }[];
}

interface FinanceContextValue {
  transactions: Transaction[];
  accounts: FinanceAccount[];
  items: PluggyItemSummary[];
  totalBalance: number;
  /** Patrimônio = saldo de contas BANK + saldos investidos. Cartões não entram. */
  netWorth: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  /** Catálogo de categorias da Pluggy (PT-BR), ordenado por categoria pai. */
  categories: PluggyCategoryNode[];
  // mutações
  updateCategory: (id: string, category: string) => void;
  confirmTransfer: (id: string) => void;
  rejectTransfer: (id: string) => void;
  markRecurring: (id: string) => void;
  ignoreRecurrence: (id: string) => void;
  applySuggestion: (id: string) => void;
  dismissPending: (id: string) => void;
  // ciclo
  cycleDay: number;
  setCycleDay: (day: number) => void;
  currentCycleRange: CycleRange;
  previousCycleRange: CycleRange;
  currentCycleLabel: string;
  // selectors derivados
  pendingByType: Record<PendingType, number>;
  pendingList: Transaction[];
  cycleTransactions: Transaction[];
  cycleTotals: CycleTotals;
  previousCycleTotals: CycleTotals;
  expensesByCategoryCycle: { name: string; value: number; color: string }[];
  // Selectors por mês civil (independente do cycleDay) — usados no Dashboard.
  monthTransactions: Transaction[];
  monthTotals: CycleTotals;
  previousMonthTotals: CycleTotals;
  expensesByCategoryMonth: { name: string; value: number; color: string }[];
  currentMonthLabel: string;
  /** Série diária do patrimônio nos últimos N dias (default 90). Crescente. */
  patrimonyHistory: { date: string; value: number }[];
  /** Verdadeiro quando o histórico precisou ser truncado/clampado por falta de dados confiáveis. */
  patrimonyHistoryIncomplete: boolean;
  /** IDs Pluggy de contas excluídas do cálculo retroativo (saldo zero + movimento recente). */
  patrimonyExcludedAccounts: string[];
  // Faturas
  bills: FinanceBill[];
  // Orçamentos
  categoryBudgets: CategoryBudget[];
  budgetProgress: BudgetProgress[];
  budgetAlerts: number;
  upsertBudget: (
    label: string,
    monthlyLimit: number,
    alertThreshold: number,
    scope?: "parent" | "child",
    parentCategoryLabel?: string | null,
  ) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  /** Limite mensal TOTAL definido pelo usuário (opcional). */
  totalBudget: TotalBudget | null;
  /** Soma dos limites de categorias-pai com orçamento. */
  parentBudgetsSum: number;
  upsertTotalBudget: (monthlyLimit: number, alertThreshold: number) => Promise<void>;
  deleteTotalBudget: () => Promise<void>;
  /** Agrega gastos de um mês civil (YYYY-MM) por categoria pai → filhas. */
  monthlyCategoryAggregates: (monthKey: string) => {
    total: number;
    items: CategoryMonthlyAgg[];
  };
  /**
   * Agrega gastos do ciclo financeiro do usuário identificado pela data final
   * do ciclo (YYYY-MM-DD do `end`). Usa o mesmo cycleDay configurado.
   */
  cycleCategoryAggregates: (cycleEndKey: string) => {
    total: number;
    items: CategoryMonthlyAgg[];
  };
  /** Lista os últimos N ciclos do usuário (mais recente primeiro), incluindo o atual. */
  lastCycles: (n: number) => CycleBucket[];
  // Configuração de ciclos por cartão (manual)
  cardCycleSettings: Record<string, CardCycleSetting>;
  upsertCardCycle: (pluggyAccountId: string, closingDay: number, dueDay: number) => Promise<void>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

const PRIORITY: Record<PendingType, number> = {
  inconsistencia: 0,
  sem_categoria: 1,
  transferencia_suspeita: 2,
  recorrencia_detectada: 3,
};

function loadCycleDay(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(STORAGE_CYCLE);
    if (!raw) return 1;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(28, Math.floor(n)));
  } catch {
    return 1;
  }
}

function computeTotals(list: Transaction[]): CycleTotals {
  let entradas = 0;
  let saidas = 0;
  for (const t of list) {
    if (t.type === "entrada") entradas += t.value;
    else saidas += Math.abs(t.value);
  }
  return { entradas, saidas, saldo: entradas - saidas };
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [items, setItems] = useState<PluggyItemSummary[]>([]);
  const [categories, setCategories] = useState<PluggyCategoryNode[]>([]);
  const [bills, setBills] = useState<FinanceBill[]>([]);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [totalBudget, setTotalBudget] = useState<TotalBudget | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cardCycleSettings, setCardCycleSettings] = useState<Record<string, CardCycleSetting>>({});
  const [cycleDay, setCycleDayState] = useState<number>(() => loadCycleDay());
  const alertedBudgetsRef = React.useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!user) {
      setTransactions([]);
      setAccounts([]);
      setItems([]);
      setBills([]);
      setCategoryBudgets([]);
      setTotalBudget(null);
      setCardCycleSettings({});
      return;
    }
    setIsLoading(true);
    try {
      const [
        { data: accData },
        { data: catData },
        { data: billData },
        { data: budgetData },
        { data: itemData },
        { data: cycleData },
        { data: totalBudgetData },
        { data: profileData },
      ] = await Promise.all([
        supabase
          .from("pluggy_accounts")
          .select(
            "id,pluggy_account_id,pluggy_item_id,name,marketing_name,type,subtype,balance,currency,credit_limit,available_credit_limit,balance_due_date,balance_close_date,minimum_payment,card_brand,card_number_last4,automatically_invested_balance",
          )
          .order("name", { ascending: true }),
        supabase
          .from("pluggy_categories")
          .select("id,description,description_translated,parent_id,parent_description")
          .order("parent_description", { ascending: true, nullsFirst: false })
          .order("description_translated", { ascending: true }),
        supabase
          .from("pluggy_bills")
          .select(
            "id,pluggy_bill_id,pluggy_account_id,pluggy_item_id,due_date,total_amount,total_amount_currency,minimum_payment_amount,allows_installments,paid",
          )
          .order("due_date", { ascending: false }),
        supabase
          .from("category_budgets")
          .select("id,category_label,monthly_limit,alert_threshold,scope,parent_category_label")
          .order("category_label", { ascending: true }),
        supabase
          .from("pluggy_items")
          .select(
            "id,pluggy_item_id,connector_name,connector_image_url,connector_primary_color,status,last_synced_at,updated_at",
          )
          .order("connector_name", { ascending: true }),
        supabase
          .from("card_cycle_settings")
          .select("pluggy_account_id,closing_day,due_day"),
        supabase
          .from("total_budget_settings")
          .select("id,monthly_limit,alert_threshold")
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("cycle_day")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      // ============================================================
      // Carregamento de transações: PAGINADO E POR ITEM (conexão).
      // PostgREST limita a 1000 linhas por request. Para garantir até
      // 5000 transações POR conexão (item Pluggy) — e não um teto
      // global do usuário — buscamos cada item em paralelo, paginando
      // em chunks de 1000 até atingir TX_LIMIT_PER_ITEM.
      // ============================================================
      const TX_LIMIT_PER_ITEM = 5000;
      const TX_PAGE_SIZE = 1000;
      const TX_SELECT =
        "id,description,amount,amount_in_account_currency,currency,account_currency,transaction_date,category,category_pluggy,category_id,pluggy_account_id,pluggy_item_id,status,operation_type,merchant_name,installment_number,total_installments,type";

      const itemIds = Array.from(
        new Set(
          (itemData ?? [])
            .map((it) => it.pluggy_item_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      type TxRow = {
        id: string;
        description: string;
        amount: number | string;
        amount_in_account_currency: number | string | null;
        currency: string;
        account_currency: string | null;
        transaction_date: string;
        category: string | null;
        category_pluggy: string | null;
        category_id: string | null;
        pluggy_account_id: string;
        pluggy_item_id: string;
        status: string | null;
        operation_type: string | null;
        merchant_name: string | null;
        installment_number: number | null;
        total_installments: number | null;
        type: string | null;
      };
      let txData: TxRow[] = [];
      if (itemIds.length === 0) {
        // Fallback: nenhuma conexão mapeada → busca direta limitada
        // ao primeiro chunk para evitar varredura completa.
        const { data } = await supabase
          .from("pluggy_transactions")
          .select(TX_SELECT)
          .order("transaction_date", { ascending: false })
          .range(0, TX_PAGE_SIZE - 1);
        txData = (data ?? []) as unknown as TxRow[];
      } else {
        const perItemResults = await Promise.all(
          itemIds.map(async (itemId) => {
            const acc: TxRow[] = [];
            for (let offset = 0; offset < TX_LIMIT_PER_ITEM; offset += TX_PAGE_SIZE) {
              const upper = Math.min(offset + TX_PAGE_SIZE, TX_LIMIT_PER_ITEM) - 1;
              const { data, error } = await supabase
                .from("pluggy_transactions")
                .select(TX_SELECT)
                .eq("pluggy_item_id", itemId)
                .order("transaction_date", { ascending: false })
                .range(offset, upper);
              if (error) {
                console.error("[finance] tx page failed", { itemId, offset, error });
                break;
              }
              const rows = (data ?? []) as unknown as TxRow[];
              acc.push(...rows);
              if (rows.length < (upper - offset + 1)) break; // fim do conjunto
            }
            return acc;
          }),
        );
        txData = perItemResults.flat();
        // Reordena globalmente por data desc para manter contrato anterior.
        txData.sort((a, b) => {
          return String(b.transaction_date ?? "").localeCompare(String(a.transaction_date ?? ""));
        });
      }

      // Index pluggy_items por pluggy_item_id pra resolver logo/cor/sync.
      type ItemMeta = {
        connectorName: string;
        connectorImageUrl: string | null;
        connectorPrimaryColor: string | null;
        status: string | null;
        lastSyncedAt: string | null;
      };
      const itemMap = new Map<string, ItemMeta>();
      for (const it of (itemData ?? [])) {
        itemMap.set(it.pluggy_item_id, {
          connectorName: it.connector_name,
          connectorImageUrl: it.connector_image_url,
          connectorPrimaryColor: it.connector_primary_color,
          status: it.status,
          lastSyncedAt: it.last_synced_at ?? it.updated_at ?? null,
        });
      }

      // Mapeia o id Pluggy da conta → nome amigável + tipo (necessário pra interpretar
      // o sinal de transações de cartão). Transações e bills referenciam pelo id Pluggy.
      type AccMeta = { name: string; type: string | null; tag: string | null };
      const accountMap = new Map<string, AccMeta>();
      const accountsByItem = new Map<string, number>();
      const accs: FinanceAccount[] = (accData ?? []).map((a) => {
        const last4 = a.card_number_last4 ?? null;
        accountMap.set(a.pluggy_account_id, {
          name: a.marketing_name || a.name,
          type: a.type,
          tag: last4 ? `••${last4}` : null,
        });
        if (a.pluggy_item_id) {
          accountsByItem.set(a.pluggy_item_id, (accountsByItem.get(a.pluggy_item_id) ?? 0) + 1);
        }
        const itemMeta = a.pluggy_item_id ? itemMap.get(a.pluggy_item_id) ?? null : null;
        return {
          id: a.id,
          pluggyAccountId: a.pluggy_account_id,
          pluggyItemId: a.pluggy_item_id ?? null,
          name: a.marketing_name || a.name,
          marketingName: a.marketing_name ?? null,
          type: a.type,
          subtype: a.subtype ?? null,
          balance: Number(a.balance ?? 0),
          creditLimit: a.credit_limit !== null ? Number(a.credit_limit) : null,
          availableCreditLimit: a.available_credit_limit !== null ? Number(a.available_credit_limit) : null,
          balanceDueDate: a.balance_due_date,
          balanceCloseDate: a.balance_close_date,
          minimumPayment: a.minimum_payment !== null ? Number(a.minimum_payment) : null,
          cardBrand: a.card_brand,
          cardNumberLast4: a.card_number_last4,
          currency: a.currency,
          automaticallyInvestedBalance:
            a.automatically_invested_balance !== null && a.automatically_invested_balance !== undefined
              ? Number(a.automatically_invested_balance)
              : null,
          connectorImageUrl: itemMeta?.connectorImageUrl ?? null,
          connectorPrimaryColor: itemMeta?.connectorPrimaryColor ?? null,
          connectorName: itemMeta?.connectorName ?? null,
          lastSyncedAt: itemMeta?.lastSyncedAt ?? null,
        };
      });
      setAccounts(accs);

      setItems(
        (itemData ?? []).map((it) => ({
          id: it.id,
          pluggyItemId: it.pluggy_item_id,
          connectorName: it.connector_name,
          connectorImageUrl: it.connector_image_url,
          connectorPrimaryColor: it.connector_primary_color,
          status: it.status,
          lastSyncedAt: it.last_synced_at ?? it.updated_at ?? null,
          accountCount: accountsByItem.get(it.pluggy_item_id) ?? 0,
        })),
      );

      setCategories(
        (catData ?? []).map((c) => ({
          id: c.id,
          description: c.description,
          descriptionTranslated: c.description_translated,
          parentId: c.parent_id,
          parentDescription: c.parent_description,
        })),
      );

      // Mapeia para nosso formato Transaction
      // Index do catálogo Pluggy: por id e por description (EN, como vem em category_pluggy).
      const catById = new Map<string, { id: string; description: string; descriptionTranslated: string | null; parentId: string | null; parentDescription: string | null }>();
      const catByDescription = new Map<string, { id: string; description: string; descriptionTranslated: string | null; parentId: string | null; parentDescription: string | null }>();
      for (const c of (catData ?? [])) {
        const node = {
          id: c.id,
          description: c.description,
          descriptionTranslated: c.description_translated,
          parentId: c.parent_id,
          parentDescription: c.parent_description,
        };
        catById.set(c.id, node);
        catByDescription.set(c.description, node);
      }

      const txs: Transaction[] = (txData ?? []).map((t) => {
        const amountRaw = Number(t.amount);
        const accMeta = accountMap.get(t.pluggy_account_id);
        const isCreditAccount = (accMeta?.type ?? "").toUpperCase() === "CREDIT";

        // Conversão de moeda (doc Pluggy: `amountInAccountCurrency`):
        // Se a transação está em moeda diferente da conta, esse campo traz
        // o valor já convertido na moeda da conta (BRL para contas BR).
        const txCurrency = t.currency ?? "BRL";
        const accCurrency = t.account_currency ?? "BRL";
        const isInternational = txCurrency !== accCurrency && t.amount_in_account_currency !== null;
        const amountConverted = isInternational
          ? Number(t.amount_in_account_currency)
          : amountRaw;

        // Sinal/direção (doc Pluggy /reference/transactions):
        //   `type` é a fonte oficial: CREDIT = inflow (entrada), DEBIT = outflow (saída).
        //   Vale para conta BANK e cartão CREDIT — Pluggy normaliza.
        // Fallback (transação sem `type` por algum conector legado):
        //   - BANK: amount > 0 = entrada
        //   - CREDIT (cartão): amount > 0 = gasto (saída) — invertido
        const txType = (t.type ?? "").toUpperCase();
        let isEntrada: boolean;
        if (txType === "CREDIT") isEntrada = true;
        else if (txType === "DEBIT") isEntrada = false;
        else isEntrada = isCreditAccount ? amountRaw < 0 : amountRaw >= 0;

        // Categoria efetiva — SEMPRE categoria PAI (top-level da hierarquia Pluggy).
        //   1. Override manual do usuário (`category`) tem prioridade — UI só oferece pais.
        //   2. Senão, resolve `category_id`/`category_pluggy` no catálogo e sobe para o pai.
        //   3. Se o nó já é pai (parent_id null), retorna ele mesmo.
        type CatNode = {
          id: string;
          description: string;
          descriptionTranslated: string | null;
          parentId: string | null;
          parentDescription: string | null;
        };
        const labelOf = (n: CatNode | null): string => (n ? (n.descriptionTranslated || n.description) : "");
        // Resolve o nó original (categoria filha quando aplicável).
        const originalNode: CatNode | null = (t.category_id && catById.get(t.category_id))
          || (t.category_pluggy && catByDescription.get(t.category_pluggy))
          || null;
        const parentNode: CatNode | null = originalNode
          ? (originalNode.parentId ? (catById.get(originalNode.parentId) ?? originalNode) : originalNode)
          : null;
        const isOriginalAlreadyParent = !!originalNode && originalNode.parentId === null;

        let effectiveCategory = "";
        if (t.category && t.category.trim().length > 0) {
          effectiveCategory = t.category;
        } else {
          effectiveCategory = labelOf(parentNode);
          if (!effectiveCategory && t.category_pluggy) {
            effectiveCategory = t.category_pluggy;
          }
        }

        const childLabel = !isOriginalAlreadyParent ? labelOf(originalNode) : null;

        const pending: PendingType | undefined = effectiveCategory === ""
          ? "sem_categoria"
          : undefined;

        return {
          id: t.id,
          date: t.transaction_date,
          description: t.description,
          category: effectiveCategory,
          account: accMeta?.name ?? "Conta",
          value: Math.abs(amountConverted),
          type: isEntrada ? "entrada" : "saida",
          pendingType: pending,
          pluggyAccountId: t.pluggy_account_id,
          status: t.status ?? null,
          operationType: t.operation_type ?? null,
          merchantName: t.merchant_name ?? null,
          installmentNumber: t.installment_number ?? null,
          totalInstallments: t.total_installments ?? null,
          accountTag: accMeta?.tag ?? null,
          // Rótulo nativo da Pluggy (e.g. "Credit card payment") — usado pela
          // inferência de pagamento de fatura.
          categoryPluggy: t.category_pluggy ?? null,
          categoryId: parentNode?.id ?? originalNode?.id ?? null,
          categoryParentId: parentNode?.id ?? null,
          categoryChildLabel: childLabel,
          // Metadados auxiliares (não-padrão do nosso Transaction, mas React aceita)
          ...(isInternational
            ? {
                originalAmount: amountRaw,
                originalCurrency: txCurrency,
              }
            : {}),
        } as Transaction;
      });
      setTransactions(txs);

      const baseBills = (billData ?? []).map((b) => ({
          id: b.id,
          pluggyBillId: b.pluggy_bill_id,
          pluggyAccountId: b.pluggy_account_id,
          pluggyItemId: b.pluggy_item_id,
          dueDate: b.due_date,
          totalAmount: b.total_amount !== null ? Number(b.total_amount) : null,
          totalAmountCurrency: b.total_amount_currency ?? "BRL",
          minimumPaymentAmount: b.minimum_payment_amount !== null ? Number(b.minimum_payment_amount) : null,
          allowsInstallments: b.allows_installments,
          paid: !!b.paid,
        }));
      const billsWithInfer: FinanceBill[] = baseBills.map((b) => {
        const inferred = !b.paid && inferBillPaid(b, txs);
        return {
          ...b,
          effectivePaid: b.paid || inferred,
          paidInferred: inferred,
        };
      });
      setBills(billsWithInfer);

      setCategoryBudgets(
        (budgetData ?? []).map((b) => ({
          id: b.id,
          categoryLabel: b.category_label,
          monthlyLimit: Number(b.monthly_limit),
          alertThreshold: Number(b.alert_threshold),
          scope: (b.scope === "child" ? "child" : "parent") as "parent" | "child",
          parentCategoryLabel: b.parent_category_label ?? null,
        })),
      );

      setTotalBudget(
        totalBudgetData
          ? {
              id: totalBudgetData.id,
              monthlyLimit: Number(totalBudgetData.monthly_limit),
              alertThreshold: Number(totalBudgetData.alert_threshold),
            }
          : null,
      );

      // Carrega cycle_day do profile do usuário (fonte de verdade — isolado por usuário).
      if (profileData && typeof profileData.cycle_day === "number") {
        const day = Math.max(1, Math.min(28, Math.floor(profileData.cycle_day)));
        setCycleDayState(day);
        try {
          window.localStorage.setItem(STORAGE_CYCLE, String(day));
        } catch {
          /* noop */
        }
      }

      const cycleMap: Record<string, CardCycleSetting> = {};
      for (const c of (cycleData ?? [])) {
        cycleMap[c.pluggy_account_id] = {
          pluggyAccountId: c.pluggy_account_id,
          closingDay: c.closing_day !== null ? Number(c.closing_day) : null,
          dueDay: c.due_day !== null ? Number(c.due_day) : null,
        };
      }
      setCardCycleSettings(cycleMap);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Carrega quando usuário muda
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: novas transactions/contas refletem na UI
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`finance-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pluggy_transactions", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pluggy_accounts", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pluggy_bills", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "category_budgets", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  // Persiste apenas a configuração de ciclo (preferência do usuário).
  const persistCycle = useCallback((day: number) => {
    try {
      window.localStorage.setItem(STORAGE_CYCLE, String(day));
    } catch {
      /* noop */
    }
  }, []);

  const setCycleDay = useCallback(
    (day: number) => {
      const safe = Math.max(1, Math.min(28, Math.floor(day)));
      setCycleDayState(safe);
      persistCycle(safe);
      // Persiste no profile do usuário para isolar entre dispositivos/sessões.
      if (user) {
        supabase
          .from("profiles")
          .update({ cycle_day: safe })
          .eq("id", user.id)
          .then(({ error }) => {
            if (error) console.error("setCycleDay persist error", error);
          });
      }
    },
    [persistCycle, user],
  );

  const patchTx = useCallback((id: string, patch: Partial<Transaction>) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const updateCategory = useCallback(
    (id: string, category: string) => {
      patchTx(id, { category, pendingType: undefined, suggestedCategory: undefined });
      // persiste no banco
      supabase
        .from("pluggy_transactions")
        .update({ category })
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("updateCategory persist error", error);
        });
    },
    [patchTx],
  );

  const confirmTransfer = useCallback(
    (id: string) => {
      patchTx(id, { category: "Transferências", pendingType: undefined });
    },
    [patchTx],
  );

  const rejectTransfer = useCallback(
    (id: string) => {
      patchTx(id, { pendingType: undefined });
    },
    [patchTx],
  );

  const markRecurring = useCallback(
    (id: string) => {
      patchTx(id, { pendingType: undefined });
    },
    [patchTx],
  );

  const ignoreRecurrence = useCallback(
    (id: string) => {
      patchTx(id, { pendingType: undefined });
    },
    [patchTx],
  );

  const applySuggestion = useCallback(
    (id: string) => {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === id && t.suggestedCategory
            ? { ...t, category: t.suggestedCategory, pendingType: undefined, suggestedCategory: undefined }
            : t,
        ),
      );
    },
    [],
  );

  const dismissPending = useCallback(
    (id: string) => {
      patchTx(id, { pendingType: undefined });
    },
    [patchTx],
  );

  const currentCycleRange = useMemo(() => getCycleRange(cycleDay, REFERENCE_DATE), [cycleDay]);
  const previousCycleRange = useMemo(
    () => getPreviousCycleRange(cycleDay, REFERENCE_DATE),
    [cycleDay],
  );
  const currentCycleLabel = useMemo(() => formatCycleLabel(currentCycleRange), [currentCycleRange]);

  const pendingList = useMemo(() => {
    return [...transactions]
      .filter((t) => !!t.pendingType)
      .sort((a, b) => {
        const pa = PRIORITY[a.pendingType!];
        const pb = PRIORITY[b.pendingType!];
        if (pa !== pb) return pa - pb;
        const ca = a.confidence ?? 1;
        const cb = b.confidence ?? 1;
        if (ca !== cb) return ca - cb;
        return a.date < b.date ? 1 : -1;
      });
  }, [transactions]);

  const pendingByType = useMemo(() => {
    const counts: Record<PendingType, number> = {
      sem_categoria: 0,
      transferencia_suspeita: 0,
      recorrencia_detectada: 0,
      inconsistencia: 0,
    };
    for (const t of pendingList) {
      counts[t.pendingType!] += 1;
    }
    return counts;
  }, [pendingList]);

  const cycleTransactions = useMemo(
    () => transactions.filter((t) => isWithinCycle(t.date, currentCycleRange)),
    [transactions, currentCycleRange],
  );

  const previousCycleTransactions = useMemo(
    () => transactions.filter((t) => isWithinCycle(t.date, previousCycleRange)),
    [transactions, previousCycleRange],
  );

  const cycleTotals = useMemo(() => computeTotals(cycleTransactions), [cycleTransactions]);
  const previousCycleTotals = useMemo(
    () => computeTotals(previousCycleTransactions),
    [previousCycleTransactions],
  );

  // Filtro comum: ignora transferências e pagamento de cartão (não são despesa real).
  const isExpenseCategory = (cat: string) => {
    if (!cat) return false;
    if (/^Transfer/i.test(cat) || /transfer/i.test(cat)) return false;
    if (/Credit card payment/i.test(cat) || /cart[aã]o de cr[eé]dito/i.test(cat)) return false;
    return true;
  };

  const expensesByCategoryCycle = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of cycleTransactions) {
      if (t.type !== "saida") continue;
      const cat = t.category || "Outros";
      if (!isExpenseCategory(cat)) continue;
      map.set(cat, (map.get(cat) ?? 0) + Math.abs(t.value));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
        color: CATEGORY_COLORS[name] ?? "hsl(220 10% 50%)",
      }))
      .sort((a, b) => b.value - a.value);
  }, [cycleTransactions]);

  // === Selectors por MÊS CIVIL (independente do cycleDay configurado para cartões) ===
  // O Dashboard usa essas séries para mostrar o resumo do mês corrente, que é o
  // que o usuário espera (o cycleDay continua governando a página de Faturas).
  const monthRanges = useMemo(() => {
    const now = REFERENCE_DATE;
    const y = now.getFullYear();
    const m = now.getMonth();
    const startCurr = new Date(y, m, 1, 0, 0, 0, 0).getTime();
    const endCurr = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();
    const startPrev = new Date(y, m - 1, 1, 0, 0, 0, 0).getTime();
    const endPrev = new Date(y, m, 0, 23, 59, 59, 999).getTime();
    return { startCurr, endCurr, startPrev, endPrev };
  }, []);

  const currentMonthLabel = useMemo(
    () => REFERENCE_DATE.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [],
  );

  const monthTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const ts = new Date(t.date).getTime();
      return ts >= monthRanges.startCurr && ts <= monthRanges.endCurr;
    });
  }, [transactions, monthRanges]);

  const previousMonthTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const ts = new Date(t.date).getTime();
      return ts >= monthRanges.startPrev && ts <= monthRanges.endPrev;
    });
  }, [transactions, monthRanges]);

  const monthTotals = useMemo(() => computeTotals(monthTransactions), [monthTransactions]);
  const previousMonthTotals = useMemo(
    () => computeTotals(previousMonthTransactions),
    [previousMonthTransactions],
  );

  const expensesByCategoryMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthTransactions) {
      if (t.type !== "saida") continue;
      const cat = t.category || "Outros";
      if (!isExpenseCategory(cat)) continue;
      map.set(cat, (map.get(cat) ?? 0) + Math.abs(t.value));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
        color: CATEGORY_COLORS[name] ?? "hsl(220 10% 50%)",
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthTransactions]);

  // === Histórico do Patrimônio — últimos 90 dias derivados do extrato ===
  // Delegado para `buildPatrimonyHistory` (testável e universal). Esse helper
  // aplica normalizações que evitam o bug de "patrimônio inicial negativo":
  //   - exclui contas BANK com saldo zero suspeito (Mercado Pago etc.);
  //   - clipa a janela à primeira transação confiável conhecida;
  //   - faz floor a 0 quando a rebobinação produz negativo (sinal de extrato
  //     mais longo que o saldo conhecido).
  const patrimonyHistoryResult = useMemo(
    () =>
      buildPatrimonyHistory(
        accounts.map((a) => ({
          pluggyAccountId: a.pluggyAccountId,
          type: a.type,
          balance: a.balance,
          automaticallyInvestedBalance: a.automaticallyInvestedBalance,
        })),
        transactions.map((t) => ({
          pluggyAccountId: t.pluggyAccountId ?? null,
          date: t.date,
          type: t.type,
          value: t.value,
        })),
        { days: 90, referenceDate: REFERENCE_DATE },
      ),
    [accounts, transactions],
  );
  const patrimonyHistory = patrimonyHistoryResult.points;
  const patrimonyHistoryIncomplete = patrimonyHistoryResult.hasIncompleteHistory;
  const patrimonyExcludedAccounts = patrimonyHistoryResult.excludedZeroBalanceAccounts;

  /**
   * Núcleo de agregação: dado um intervalo [startMs, endMs], devolve total e itens
   * por categoria pai → filhas (apenas categorias com gasto > 0).
   */
  const aggregateExpensesInRange = useCallback(
    (startMs: number, endMs: number) => {
      const parents = new Map<string, { spent: number; children: Map<string, number> }>();
      let total = 0;
      for (const t of transactions) {
        if (t.type !== "saida") continue;
        const ts = new Date(t.date).getTime();
        if (Number.isNaN(ts) || ts < startMs || ts > endMs) continue;
        const parentLabel = (t.category || "").trim() || "Outros";
        if (!isExpenseCategory(parentLabel)) continue;
        const childLabel = (t.categoryChildLabel || "").trim() || `Outros · ${parentLabel}`;
        const entry = parents.get(parentLabel) ?? { spent: 0, children: new Map<string, number>() };
        const v = Math.abs(t.value);
        entry.spent += v;
        entry.children.set(childLabel, (entry.children.get(childLabel) ?? 0) + v);
        parents.set(parentLabel, entry);
        total += v;
      }
      const items: CategoryMonthlyAgg[] = Array.from(parents.entries())
        .map(([parentLabel, data]) => ({
          parentLabel,
          parentId: null,
          spent: data.spent,
          pctOfTotal: total > 0 ? data.spent / total : 0,
          children: Array.from(data.children.entries())
            .map(([label, spent]) => ({
              label,
              spent,
              pctOfParent: data.spent > 0 ? spent / data.spent : 0,
            }))
            .sort((a, b) => b.spent - a.spent),
        }))
        .sort((a, b) => b.spent - a.spent);
      return { total, items };
    },
    [transactions],
  );

  /** Mantido por compatibilidade (Dashboard, etc.). */
  const monthlyCategoryAggregates = useCallback(
    (monthKey: string) => {
      const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
      if (!m) return { total: 0, items: [] };
      const year = Number(m[1]);
      const month = Number(m[2]) - 1;
      const start = new Date(year, month, 1, 0, 0, 0, 0).getTime();
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
      return aggregateExpensesInRange(start, end);
    },
    [aggregateExpensesInRange],
  );

  /**
   * Agrega gastos do CICLO FINANCEIRO do usuário. A chave é o YYYY-MM-DD da data
   * final do ciclo (mesmo formato emitido por `lastNCycles`).
   */
  const cycleCategoryAggregates = useCallback(
    (cycleEndKey: string) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cycleEndKey);
      if (!m) return { total: 0, items: [] };
      const year = Number(m[1]);
      const month = Number(m[2]) - 1;
      const day = Number(m[3]);
      // Usa o dia do meio para evitar borda — getCycleRange resolve.
      const ref = new Date(year, month, day, 12, 0, 0, 0);
      const range = getCycleRange(cycleDay, ref);
      return aggregateExpensesInRange(range.start.getTime(), range.end.getTime());
    },
    [aggregateExpensesInRange, cycleDay],
  );

  const lastCycles = useCallback(
    (n: number) => lastNCycles(n, cycleDay, REFERENCE_DATE),
    [cycleDay],
  );

  // Progresso de orçamentos — usa o CICLO FINANCEIRO CORRENTE definido pelo usuário.
  const budgetProgress = useMemo<BudgetProgress[]>(() => {
    const range = getCycleRange(cycleDay, REFERENCE_DATE);
    const agg = aggregateExpensesInRange(range.start.getTime(), range.end.getTime());
    const parentSpent = new Map<string, number>();
    const childSpent = new Map<string, number>(); // chave: `${parent}::${child}`
    for (const item of agg.items) {
      parentSpent.set(item.parentLabel, item.spent);
      for (const c of item.children) {
        childSpent.set(`${item.parentLabel}::${c.label}`, c.spent);
      }
    }
    return categoryBudgets.map((b) => {
      const spent = b.scope === "child" && b.parentCategoryLabel
        ? (childSpent.get(`${b.parentCategoryLabel}::${b.categoryLabel}`) ?? 0)
        : (parentSpent.get(b.categoryLabel) ?? 0);
      const ratio = b.monthlyLimit > 0 ? spent / b.monthlyLimit : 0;
      let status: BudgetStatus = "ok";
      if (ratio >= 1) status = "over";
      else if (ratio >= b.alertThreshold) status = "alert";
      return {
        categoryLabel: b.categoryLabel,
        spent,
        limit: b.monthlyLimit,
        threshold: b.alertThreshold,
        ratio,
        status,
        budgetId: b.id,
        scope: b.scope,
        parentCategoryLabel: b.parentCategoryLabel,
      };
    });
  }, [categoryBudgets, aggregateExpensesInRange, cycleDay]);

  const budgetAlerts = useMemo(
    () => budgetProgress.filter((b) => b.status !== "ok").length,
    [budgetProgress],
  );

  // Toast de aviso quando um orçamento entra em alert/over (sem disparar duplicado).
  useEffect(() => {
    for (const b of budgetProgress) {
      const key = `${b.budgetId}:${b.status}`;
      if (b.status !== "ok" && !alertedBudgetsRef.current.has(key)) {
        alertedBudgetsRef.current.add(key);
        if (b.status === "over") {
          toast.error(`Orçamento de "${b.categoryLabel}" foi estourado.`);
        } else {
          toast.warning(`Você atingiu ${(b.ratio * 100).toFixed(0)}% do orçamento de "${b.categoryLabel}".`);
        }
      }
    }
  }, [budgetProgress]);

  const upsertBudget = useCallback(
    async (
      label: string,
      monthlyLimit: number,
      alertThreshold: number,
      scope: "parent" | "child" = "parent",
      parentCategoryLabel: string | null = null,
    ) => {
      if (!user) return;
      const { error } = await supabase
        .from("category_budgets")
        .upsert(
          {
            user_id: user.id,
            category_label: label,
            monthly_limit: monthlyLimit,
            alert_threshold: alertThreshold,
            scope,
            parent_category_label: scope === "child" ? parentCategoryLabel : null,
          },
          { onConflict: "user_id,category_label" },
        );
      if (error) {
        console.error("upsertBudget error", error);
        toast.error("Não foi possível salvar o orçamento.");
        return;
      }
      await refresh();
    },
    [user, refresh],
  );

  const deleteBudget = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("category_budgets").delete().eq("id", id);
      if (error) {
        console.error("deleteBudget error", error);
        toast.error("Não foi possível remover o orçamento.");
        return;
      }
      await refresh();
    },
    [refresh],
  );

  const parentBudgetsSum = useMemo(
    () =>
      categoryBudgets
        .filter((b) => b.scope === "parent")
        .reduce((s, b) => s + b.monthlyLimit, 0),
    [categoryBudgets],
  );

  const upsertTotalBudget = useCallback(
    async (monthlyLimit: number, alertThreshold: number) => {
      if (!user) return;
      const { error } = await supabase
        .from("total_budget_settings")
        .upsert(
          {
            user_id: user.id,
            monthly_limit: monthlyLimit,
            alert_threshold: alertThreshold,
          },
          { onConflict: "user_id" },
        );
      if (error) {
        console.error("upsertTotalBudget error", error);
        toast.error("Não foi possível salvar o limite total.");
        return;
      }
      await refresh();
    },
    [user, refresh],
  );

  const deleteTotalBudget = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase
      .from("total_budget_settings")
      .delete()
      .eq("user_id", user.id);
    if (error) {
      console.error("deleteTotalBudget error", error);
      toast.error("Não foi possível remover o limite total.");
      return;
    }
    await refresh();
  }, [user, refresh]);

  const upsertCardCycle = useCallback(
    async (pluggyAccountId: string, closingDay: number, dueDay: number) => {
      if (!user) return;
      const { error } = await supabase
        .from("card_cycle_settings")
        .upsert(
          {
            user_id: user.id,
            pluggy_account_id: pluggyAccountId,
            closing_day: closingDay,
            due_day: dueDay,
          },
          { onConflict: "user_id,pluggy_account_id" },
        );
      if (error) {
        console.error("upsertCardCycle error", error);
        toast.error("Não foi possível salvar a configuração do ciclo.");
        return;
      }
      // Atualização otimista local — Pluggy não emite realtime para essa tabela.
      setCardCycleSettings((prev) => ({
        ...prev,
        [pluggyAccountId]: { pluggyAccountId, closingDay, dueDay },
      }));
    },
    [user],
  );

  // Saldo consolidado: contas bancárias somam positivo, cartões (CREDIT) entram
  // como dívida (saldo da fatura aberta é positivo na API → vira negativo aqui).
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, a) => {
      const bal = a.balance ?? 0;
      if ((a.type ?? "").toUpperCase() === "CREDIT") return sum - Math.abs(bal);
      return sum + bal;
    }, 0);
  }, [accounts]);

  // Patrimônio = saldo de contas (BANK/INVESTMENT) + saldo automaticamente investido.
  // Cartões (CREDIT) ficam de fora — fatura aberta não é dívida líquida do patrimônio.
  const netWorth = useMemo(() => {
    return accounts.reduce((sum, a) => {
      const type = (a.type ?? "").toUpperCase();
      if (type === "CREDIT") return sum;
      // IMPORTANTE: o `balance` retornado pelo Pluggy para contas BANK JÁ inclui
      // o `automatically_invested_balance` (que é apenas a parcela do saldo que
      // está rendendo). Somar os dois duplicaria o valor — usar só `balance`.
      return sum + (a.balance ?? 0);
    }, 0);
  }, [accounts]);

  const value: FinanceContextValue = {
    transactions,
    accounts,
    items,
    totalBalance,
    netWorth,
    isLoading,
    refresh,
    categories,
    updateCategory,
    confirmTransfer,
    rejectTransfer,
    markRecurring,
    ignoreRecurrence,
    applySuggestion,
    dismissPending,
    cycleDay,
    setCycleDay,
    currentCycleRange,
    previousCycleRange,
    currentCycleLabel,
    pendingByType,
    pendingList,
    cycleTransactions,
    cycleTotals,
    previousCycleTotals,
    expensesByCategoryCycle,
    monthTransactions,
    monthTotals,
    previousMonthTotals,
    expensesByCategoryMonth,
    currentMonthLabel,
    patrimonyHistory,
    patrimonyHistoryIncomplete,
    patrimonyExcludedAccounts,
    bills,
    categoryBudgets,
    budgetProgress,
    budgetAlerts,
    upsertBudget,
    deleteBudget,
    totalBudget,
    parentBudgetsSum,
    upsertTotalBudget,
    deleteTotalBudget,
    monthlyCategoryAggregates,
    cycleCategoryAggregates,
    lastCycles,
    cardCycleSettings,
    upsertCardCycle,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance deve ser usado dentro de <FinanceProvider>");
  return ctx;
}
