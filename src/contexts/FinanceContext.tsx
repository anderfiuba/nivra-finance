import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  CATEGORIES,
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

const STORAGE_CYCLE = "nivra:cycleDay:v1";
// Sempre usa a data atual — sem mock.
const REFERENCE_DATE = new Date();

type CycleTotals = { entradas: number; saidas: number; saldo: number };

interface FinanceContextValue {
  transactions: Transaction[];
  categories: readonly string[];
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
  // Por enquanto começa vazio — será populado pelas transações reais
  // sincronizadas via Pluggy (próxima etapa).
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cycleDay, setCycleDayState] = useState<number>(() => loadCycleDay());

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
      // Não computa transferências como despesa
      if (cat === "Transferências") continue;
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

  const value: FinanceContextValue = {
    transactions,
    categories: CATEGORIES,
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
