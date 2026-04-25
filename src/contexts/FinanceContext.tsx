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

const STORAGE_CYCLE = "nivra:cycleDay:v1";
// Sempre usa a data atual — sem mock.
const REFERENCE_DATE = new Date();

type CycleTotals = { entradas: number; saidas: number; saldo: number };

export interface FinanceAccount {
  id: string;
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
}

export interface PluggyCategoryNode {
  id: string;
  description: string;
  descriptionTranslated: string | null;
  parentId: string | null;
  parentDescription: string | null;
}

interface FinanceContextValue {
  transactions: Transaction[];
  accounts: FinanceAccount[];
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
  const [categories, setCategories] = useState<PluggyCategoryNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cycleDay, setCycleDayState] = useState<number>(() => loadCycleDay());

  const refresh = useCallback(async () => {
    if (!user) {
      setTransactions([]);
      setAccounts([]);
      return;
    }
    setIsLoading(true);
    try {
      const [{ data: accData }, { data: txData }, { data: catData }] = await Promise.all([
        supabase
          .from("pluggy_accounts")
          .select(
            "id,name,marketing_name,type,subtype,balance,currency,credit_limit,available_credit_limit,balance_due_date,balance_close_date,minimum_payment,card_brand,card_number_last4",
          )
          .order("name", { ascending: true }),
        supabase
          .from("pluggy_transactions")
          .select(
            "id,description,amount,amount_in_account_currency,currency,account_currency,transaction_date,category,category_pluggy,category_id,pluggy_account_id,status,operation_type,merchant_name,installment_number,total_installments",
          )
          .order("transaction_date", { ascending: false })
          .limit(1000),
        supabase
          .from("pluggy_categories")
          .select("id,description,description_translated,parent_id,parent_description")
          .order("parent_description", { ascending: true, nullsFirst: false })
          .order("description_translated", { ascending: true }),
      ]);

      // Mapeia o id de conta Pluggy → nome amigável + tipo (necessário pra interpretar
      // o sinal de transações de cartão).
      type AccMeta = { name: string; type: string | null };
      const accountMap = new Map<string, AccMeta>();
      const accs: FinanceAccount[] = (accData ?? []).map((a) => {
        accountMap.set(a.id, { name: a.marketing_name || a.name, type: a.type });
        return {
          id: a.id,
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
        };
      });
      setAccounts(accs);

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
      const txs: Transaction[] = (txData ?? []).map((t) => {
        const amountRaw = Number(t.amount);
        const accMeta = accountMap.get(t.pluggy_account_id);
        const isCreditAccount = (accMeta?.type ?? "").toUpperCase() === "CREDIT";

        // Conversão de moeda: se a transação está numa moeda diferente da conta,
        // a Pluggy entrega o valor já convertido em `amount_in_account_currency`.
        // Esse é o valor que faz sentido para o saldo do usuário.
        const txCurrency = t.currency ?? "BRL";
        const accCurrency = t.account_currency ?? accMeta ? "BRL" : "BRL";
        const amountConverted = txCurrency !== (t.account_currency ?? "BRL")
          && t.amount_in_account_currency !== null
          ? Number(t.amount_in_account_currency)
          : amountRaw;

        // Sinal para nosso modelo "entrada/saida":
        //  - Conta BANK: amount > 0 = entrada, < 0 = saída (Pluggy já entrega correto).
        //  - Cartão CREDIT: amount > 0 = gasto (saída), < 0 = pagamento da fatura (entrada).
        //    Ou seja, INVERTEMOS apenas para exibição.
        const signedAmount = isCreditAccount ? -amountConverted : amountConverted;
        const isEntrada = signedAmount >= 0;

        // Categoria efetiva: override manual > Pluggy.
        const effectiveCategory = (t.category && t.category.trim().length > 0)
          ? t.category
          : (t.category_pluggy ?? "");

        // Pendente apenas se nem usuário nem Pluggy categorizou.
        const pending: PendingType | undefined = effectiveCategory === ""
          ? "sem_categoria"
          : undefined;

        return {
          id: t.id,
          date: t.transaction_date,
          description: t.description,
          category: effectiveCategory,
          account: accMeta?.name ?? "Conta",
          value: Math.abs(signedAmount),
          type: isEntrada ? "entrada" : "saida",
          pendingType: pending,
          // Metadados auxiliares (não-padrão do nosso Transaction, mas Reactjs aceita)
          ...(txCurrency !== accCurrency && t.amount_in_account_currency !== null
            ? {
                originalAmount: amountRaw,
                originalCurrency: txCurrency,
              }
            : {}),
        } as Transaction;
      });
      setTransactions(txs);
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
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance deve ser usado dentro de <FinanceProvider>");
  return ctx;
}
