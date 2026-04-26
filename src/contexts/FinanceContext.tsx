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
      ] = await Promise.all([
        supabase
          .from("pluggy_accounts")
          .select(
            "id,pluggy_account_id,pluggy_item_id,name,marketing_name,type,subtype,balance,currency,credit_limit,available_credit_limit,balance_due_date,balance_close_date,minimum_payment,card_brand,card_number_last4",
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

  const expensesByCategoryCycle = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of cycleTransactions) {
      if (t.type !== "saida") continue;
      const cat = t.category || "Outros";
      // Não computa transferências/pagamento de cartão como despesa real.
      if (/^Transfer/i.test(cat) || /transfer/i.test(cat) || /Credit card payment/i.test(cat) || /cart[aã]o de cr[eé]dito/i.test(cat)) {
        continue;
      }
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

  // Progresso de orçamentos: como toda transação já é resolvida para a
  // categoria PAI no `effectiveCategory`, basta cruzar pelo rótulo direto.
  const budgetProgress = useMemo<BudgetProgress[]>(() => {
    const spentMap = new Map<string, number>();
    for (const e of expensesByCategoryCycle) {
      spentMap.set(e.name, (spentMap.get(e.name) ?? 0) + e.value);
    }
    return categoryBudgets.map((b) => {
      const spent = spentMap.get(b.categoryLabel) ?? 0;
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
      };
    });
  }, [categoryBudgets, expensesByCategoryCycle]);

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
    async (label: string, monthlyLimit: number, alertThreshold: number) => {
      if (!user) return;
      const { error } = await supabase
        .from("category_budgets")
        .upsert(
          {
            user_id: user.id,
            category_label: label,
            monthly_limit: monthlyLimit,
            alert_threshold: alertThreshold,
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

  const value: FinanceContextValue = {
    transactions,
    accounts,
    items,
    totalBalance,
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
    bills,
    categoryBudgets,
    budgetProgress,
    budgetAlerts,
    upsertBudget,
    deleteBudget,
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
