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
} from "@/lib/cycle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { inferBillPaid } from "@/lib/billPayment";

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
        { data: txData },
        { data: catData },
        { data: billData },
        { data: budgetData },
        { data: itemData },
        { data: cycleData },
        { data: totalBudgetData },
      ] = await Promise.all([
        supabase
          .from("pluggy_accounts")
          .select(
            "id,pluggy_account_id,pluggy_item_id,name,marketing_name,type,subtype,balance,currency,credit_limit,available_credit_limit,balance_due_date,balance_close_date,minimum_payment,card_brand,card_number_last4,automatically_invested_balance",
          )
          .order("name", { ascending: true }),
        supabase
          .from("pluggy_transactions")
          .select(
            "id,description,amount,amount_in_account_currency,currency,account_currency,transaction_date,category,category_pluggy,category_id,pluggy_account_id,status,operation_type,merchant_name,installment_number,total_installments,type",
          )
          .order("transaction_date", { ascending: false })
          .limit(5000),
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
      ]);

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

  const setCycleDay = useCallback((day: number) => {
    const safe = Math.max(1, Math.min(28, Math.floor(day)));
    setCycleDayState(safe);
    persistCycle(safe);
  }, [persistCycle]);

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
  // Como não armazenamos snapshots, derivamos: patrimônio(t) = patrimônio_atual
  // − (entradas BANK depois de t) + (saídas BANK depois de t). Cartões não
  // afetam patrimônio (afetam fatura). Resultado: 1 ponto por dia, crescente.
  const patrimonyHistory = useMemo(() => {
    const DAYS = 90;
    const bankAccountIds = new Set(
      accounts
        .filter((a) => (a.type ?? "").toUpperCase() !== "CREDIT")
        .map((a) => a.pluggyAccountId),
    );
    if (bankAccountIds.size === 0) return [];

    const current = accounts.reduce((sum, a) => {
      if ((a.type ?? "").toUpperCase() === "CREDIT") return sum;
      return sum + (a.balance ?? 0);
    }, 0);

    const byDay = new Map<string, number>();
    for (const t of transactions) {
      if (!bankAccountIds.has(t.pluggyAccountId ?? "")) continue;
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const delta = t.type === "entrada" ? t.value : -Math.abs(t.value);
      byDay.set(key, (byDay.get(key) ?? 0) + delta);
    }

    const today = new Date(REFERENCE_DATE);
    today.setHours(0, 0, 0, 0);
    const points: { date: string; value: number }[] = [];
    let value = current;
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      points.push({ date: key, value: Math.round(value * 100) / 100 });
      const delta = byDay.get(key) ?? 0;
      value -= delta;
    }
    return points.reverse();
  }, [accounts, transactions]);

  /**
   * Agrega gastos do mês civil (chave YYYY-MM) por categoria pai → filhas.
   * Resultado contém apenas categorias com gasto > 0 (sob demanda).
   */
  const monthlyCategoryAggregates = useCallback(
    (monthKey: string) => {
      // mês civil
      const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
      if (!m) return { total: 0, items: [] };
      const year = Number(m[1]);
      const month = Number(m[2]) - 1;
      const start = new Date(year, month, 1, 0, 0, 0, 0).getTime();
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

      // map: parentLabel -> { total, children: Map(childLabel -> spent) }
      const parents = new Map<string, { spent: number; children: Map<string, number> }>();
      let total = 0;
      for (const t of transactions) {
        if (t.type !== "saida") continue;
        const ts = new Date(t.date).getTime();
        if (Number.isNaN(ts) || ts < start || ts > end) continue;
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

  // Progresso de orçamentos — calcula no MÊS CIVIL CORRENTE, suportando pai e filha.
  const budgetProgress = useMemo<BudgetProgress[]>(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const agg = monthlyCategoryAggregates(monthKey);
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
  }, [categoryBudgets, monthlyCategoryAggregates]);

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
