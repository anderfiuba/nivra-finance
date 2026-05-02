import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Settings2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useFinance } from "@/contexts/FinanceContext";
import {
  computeCurrentCycleWindow,
  computeNextCycleWindow,
  daysUntil,
  formatDueLabel,
  formatShortDate,
  formatShortDateFromIso,
  resolveCycleDays,
  type CycleDays,
  type CycleWindow,
} from "@/lib/cardCycle";
import { TotalPagarCard } from "@/components/faturas/TotalPagarCard";
import { ConfigCiclosCard } from "@/components/faturas/ConfigCiclosCard";
import { CicloRow, type CicloStatus } from "@/components/faturas/CicloRow";
import type { FinanceAccount, FinanceBill } from "@/contexts/FinanceContext";
import type { Transaction } from "@/data/mockData";

/**
 * Faturas — visão consolidada de todos os cartões, no formato do PDF de
 * referência. Estrutura:
 *  1. Total a pagar (agregado, breakdown Parcelas/Compras avulsas).
 *  2. Banner de configuração de fechamento/vencimento (cartões pendentes).
 *  3. Ciclos de Faturamento (uma linha por ciclo aberto/fechado).
 *  4. Próximas Faturas.
 *  5. Recentemente Pagas.
 *
 * Fontes (reais, via Pluggy):
 *  - pluggy_accounts (type=CREDIT)
 *  - pluggy_bills (faturas mensais)
 *  - pluggy_transactions (composição do ciclo)
 *  - card_cycle_settings (override manual quando Pluggy não traz datas)
 */

const installmentRegex = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/;
const DISMISS_KEY = "nivra:faturas:configDismissed:v1";

function isInstallmentTx(t: Transaction): boolean {
  if (t.installmentNumber !== null && t.totalInstallments !== null && t.totalInstallments > 1) {
    return true;
  }
  return installmentRegex.test(t.description);
}

/**
 * Filtra transações de DESPESA (saída) do cartão dentro de uma janela.
 * Pagamentos de fatura (CREDIT) são ignorados — eles zeram o saldo, não compõem fatura.
 */
function txsInWindow(
  all: Transaction[],
  pluggyAccountId: string,
  start: Date,
  end: Date,
): Transaction[] {
  const s = start.getTime();
  const e = end.getTime();
  return all.filter((t) => {
    if (t.pluggyAccountId !== pluggyAccountId) return false;
    if (t.type !== "saida") return false;
    const td = new Date(t.date).getTime();
    return td >= s && td <= e;
  });
}

/** Soma de despesas (compras + parcelas) de um conjunto. */
function sumExpenses(txs: Transaction[]): number {
  return txs.reduce((a, t) => a + Math.abs(t.value), 0);
}

function dueTone(date: Date): "muted" | "warning" | "danger" {
  const d = daysUntil(date);
  if (d < 0 || d <= 3) return "danger";
  if (d <= 7) return "warning";
  return "muted";
}

interface OpenItem {
  account: FinanceAccount;
  status: CicloStatus;
  amount: number;
  cycleLabel: string;
  dueLabel: string;
  startLabel: string;
  endLabel: string;
  dueDate: Date;
  minimumPayment: number | null;
  txs: Transaction[];
  installmentCount: number;
  oneOffCount: number;
  installmentTotal: number;
  oneOffTotal: number;
  showEstimateNotice: boolean;
  bill?: FinanceBill;
  /** Sort key (proximidade do vencimento). */
  sortKey: number;
}

const Faturas = () => {
  const { accounts, bills, transactions, cardCycleSettings } = useFinance();

  const [dismissedConfig, setDismissedConfig] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  });
  const [showEditConfig, setShowEditConfig] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DISMISS_KEY, dismissedConfig ? "1" : "0");
  }, [dismissedConfig]);

  const creditAccounts = useMemo(
    () => accounts.filter((a) => (a.type ?? "").toUpperCase() === "CREDIT"),
    [accounts],
  );

  /**
   * Para cada cartão, resolve dias do ciclo (manual > Pluggy). Cartões sem
   * resolução vão para o banner de configuração.
   */
  const accountsWithDays = useMemo(() => {
    return creditAccounts.map((acc) => {
      const setting = cardCycleSettings[acc.pluggyAccountId] ?? null;
      const days = resolveCycleDays(acc, setting);
      return { account: acc, days };
    });
  }, [creditAccounts, cardCycleSettings]);

  const pendingConfigAccounts = useMemo(
    () => accountsWithDays.filter((x) => !x.days).map((x) => x.account),
    [accountsWithDays],
  );

  /**
   * Constrói os "ciclos abertos a pagar" para cada cartão configurado:
   *  - Se existe fatura FECHADA não-paga (due >= hoje - 7d) → entra como "fechada".
   *  - Sempre adiciona o ciclo ATUAL estimado pelas transações.
   */
  const openItems = useMemo<OpenItem[]>(() => {
    const now = new Date();
    const items: OpenItem[] = [];

    for (const { account, days } of accountsWithDays) {
      if (!days) continue;
      const current = computeCurrentCycleWindow(days, now);

      // Janela do ciclo anterior (já fechado) — última fatura emitida.
      const prevRef = new Date(current.start.getTime() - 24 * 60 * 60 * 1000);
      const previous = computeCurrentCycleWindow(days, prevRef);

      // Procura uma bill emitida pela Pluggy cujo dueDate corresponde ao
      // vencimento do ciclo anterior. Tolerância: mesmo mês.
      const matchingBill = findBillForDue(bills, account.pluggyAccountId, previous.dueDate);

      if (matchingBill && !matchingBill.effectivePaid) {
        const bTxs = txsInWindow(transactions, account.pluggyAccountId, previous.start, previous.closingDate);
        const installs = bTxs.filter(isInstallmentTx);
        const oneOffs = bTxs.filter((t) => !isInstallmentTx(t));
        const due = matchingBill.dueDate
          ? new Date(matchingBill.dueDate + "T00:00:00")
          : previous.dueDate;
        const isLate = daysUntil(due) < 0;
        items.push({
          account,
          status: isLate ? "vencida" : "fechada",
          amount: matchingBill.totalAmount ?? sumExpenses(bTxs),
          cycleLabel: `${formatShortDate(previous.start)} - ${formatShortDate(previous.closingDate)}`,
          dueLabel: formatShortDateFromIso(matchingBill.dueDate),
          startLabel: formatShortDate(previous.closingDate),
          endLabel: formatShortDateFromIso(matchingBill.dueDate),
          dueDate: due,
          minimumPayment: matchingBill.minimumPaymentAmount,
          txs: bTxs,
          installmentCount: installs.length,
          oneOffCount: oneOffs.length,
          installmentTotal: sumExpenses(installs),
          oneOffTotal: sumExpenses(oneOffs),
          showEstimateNotice: false,
          bill: matchingBill,
          sortKey: due.getTime(),
        });
      }

      // Ciclo atual estimado (sempre adicionado).
      const cTxs = txsInWindow(transactions, account.pluggyAccountId, current.start, now);
      const installs = cTxs.filter(isInstallmentTx);
      const oneOffs = cTxs.filter((t) => !isInstallmentTx(t));
      items.push({
        account,
        status: "atual",
        amount: sumExpenses(cTxs),
        cycleLabel: `${formatShortDate(current.start)} - ${formatShortDate(current.closingDate)}`,
        dueLabel: formatShortDate(current.dueDate),
        startLabel: formatShortDate(now),
        endLabel: formatShortDate(current.dueDate),
        dueDate: current.dueDate,
        minimumPayment: null,
        txs: cTxs,
        installmentCount: installs.length,
        oneOffCount: oneOffs.length,
        installmentTotal: sumExpenses(installs),
        oneOffTotal: sumExpenses(oneOffs),
        showEstimateNotice: true,
        sortKey: current.dueDate.getTime(),
      });
    }

    return items.sort((a, b) => a.sortKey - b.sortKey);
  }, [accountsWithDays, bills, transactions]);

  /** Próximas faturas: ciclo N+1 (já com parcelas alocadas). */
  const upcomingItems = useMemo<OpenItem[]>(() => {
    const items: OpenItem[] = [];
    for (const { account, days } of accountsWithDays) {
      if (!days) continue;
      const current = computeCurrentCycleWindow(days, new Date());
      const next = computeNextCycleWindow(days, current);
      const txs = txsInWindow(transactions, account.pluggyAccountId, next.start, next.closingDate);
      // Só mostra próxima se existirem parcelas/compras já alocadas.
      if (txs.length === 0) continue;
      const installs = txs.filter(isInstallmentTx);
      const oneOffs = txs.filter((t) => !isInstallmentTx(t));
      items.push({
        account,
        status: "proxima",
        amount: sumExpenses(txs),
        cycleLabel: `${formatShortDate(next.start)} - ${formatShortDate(next.closingDate)}`,
        dueLabel: formatShortDate(next.dueDate),
        startLabel: formatShortDate(next.start),
        endLabel: formatShortDate(next.dueDate),
        dueDate: next.dueDate,
        minimumPayment: null,
        txs,
        installmentCount: installs.length,
        oneOffCount: oneOffs.length,
        installmentTotal: sumExpenses(installs),
        oneOffTotal: sumExpenses(oneOffs),
        showEstimateNotice: true,
        sortKey: next.dueDate.getTime(),
      });
    }
    return items.sort((a, b) => a.sortKey - b.sortKey);
  }, [accountsWithDays, transactions]);

  /** Recentemente pagas: bills com paid=true OU venceram há mais de 7 dias. */
  const paidItems = useMemo(() => {
    const now = Date.now();
    return bills
      .filter((b) => {
        if (b.effectivePaid) return true;
        if (!b.dueDate) return false;
        const due = new Date(b.dueDate + "T00:00:00").getTime();
        return now - due > 7 * 24 * 60 * 60 * 1000;
      })
      .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""))
      .slice(0, 6)
      .map((bill) => {
        const account = creditAccounts.find((a) => a.pluggyAccountId === bill.pluggyAccountId);
        return account ? { bill, account } : null;
      })
      .filter((x): x is { bill: FinanceBill; account: FinanceAccount } => x !== null);
  }, [bills, creditAccounts]);

  /** Total a pagar = soma dos itens "abertos" (fechada não-paga + ciclo atual). */
  const totals = useMemo(() => {
    let total = 0;
    let installments = 0;
    let oneOff = 0;
    for (const it of openItems) {
      total += it.amount;
      installments += it.installmentTotal;
      oneOff += it.oneOffTotal;
    }
    return { total, installments, oneOff };
  }, [openItems]);

  // Quantidade de bills marcadas como pagas via inferência (informativo).
  const inferredPaidCount = useMemo(
    () => bills.filter((b) => b.paidInferred).length,
    [bills],
  );

  // Estado vazio (sem cartões conectados).
  if (creditAccounts.length === 0) {
    return (
      <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">Faturas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Detalhamento das faturas do seu cartão de crédito mês a mês.
        </p>
        <Card className="mt-6 bg-card shadow-none border-border p-12 text-center">
          <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-base font-semibold text-foreground">Nenhum cartão conectado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Conecte um cartão de crédito via Open Finance para visualizar suas faturas.
          </p>
          <Button asChild className="mt-4 bg-gradient-primary text-primary-foreground hover:opacity-90">
            <Link to="/app/conexoes">Ir para Conexões</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const showConfig = pendingConfigAccounts.length > 0 && !dismissedConfig;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">Faturas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Visão consolidada — fatura fechada, ciclo atual estimado e próximas faturas dos seus cartões.
            </p>
          </div>
          {creditAccounts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditConfig((v) => !v)}
              className="shrink-0"
            >
              <Settings2 className="h-4 w-4 mr-1.5" />
              {showEditConfig ? "Fechar ajuste" : "Ajustar fechamento"}
            </Button>
          )}
        </div>
        {inferredPaidCount > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              {inferredPaidCount === 1
                ? "1 fatura foi marcada como paga automaticamente"
                : `${inferredPaidCount} faturas foram marcadas como pagas automaticamente`}
              {" "}com base em pagamentos detectados nas suas transações.
            </p>
          </div>
        )}
      </div>

      {/* 1. Total a pagar */}
      <TotalPagarCard
        total={totals.total}
        installments={totals.installments}
        oneOff={totals.oneOff}
        message={
          openItems.length === 0
            ? "Sem cobranças pendentes neste momento."
            : "Inclui faturas fechadas e estimativas dos ciclos atuais."
        }
      />

      {/* 2. Banner de configuração (cartões pendentes) */}
      {showConfig && (
        <ConfigCiclosCard
          pendingAccounts={pendingConfigAccounts}
          onDismiss={() => setDismissedConfig(true)}
        />
      )}

      {/* 2b. Modo edição (todos os cartões) */}
      {showEditConfig && (
        <ConfigCiclosCard
          pendingAccounts={creditAccounts}
          mode="edit"
          onDismiss={() => setShowEditConfig(false)}
          onSaved={() => setShowEditConfig(false)}
        />
      )}

      {/* 3. Ciclos de Faturamento */}
      {openItems.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-foreground tracking-tight">Ciclos de Faturamento</h2>
          <Card className="mt-3 bg-card shadow-none border-border overflow-hidden divide-y divide-border">
            {openItems.map((it, idx) => (
              <CicloRow
                key={`${it.account.id}-${it.status}-${idx}`}
                account={it.account}
                status={it.status}
                amount={it.amount}
                cycleLabel={it.cycleLabel}
                dueLabel={it.dueLabel}
                startLabel={it.startLabel}
                endLabel={it.endLabel}
                minimumPayment={it.minimumPayment}
                installmentCount={it.installmentCount}
                oneOffCount={it.oneOffCount}
                showEstimateNotice={it.showEstimateNotice}
                dueStatusText={formatDueLabel(it.dueDate)}
                dueStatusTone={dueTone(it.dueDate)}
                transactions={it.txs}
              />
            ))}
          </Card>
        </section>
      )}

      {/* 4. Próximas Faturas */}
      {upcomingItems.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-foreground tracking-tight">Próximas Faturas</h2>
          <Card className="mt-3 bg-card shadow-none border-border overflow-hidden divide-y divide-border">
            {upcomingItems.map((it, idx) => (
              <CicloRow
                key={`upcoming-${it.account.id}-${idx}`}
                account={it.account}
                status={it.status}
                amount={it.amount}
                cycleLabel={it.cycleLabel}
                dueLabel={it.dueLabel}
                startLabel={it.startLabel}
                endLabel={it.endLabel}
                minimumPayment={it.minimumPayment}
                installmentCount={it.installmentCount}
                oneOffCount={it.oneOffCount}
                showEstimateNotice={it.showEstimateNotice}
                dueStatusText={formatDueLabel(it.dueDate)}
                dueStatusTone={dueTone(it.dueDate)}
                transactions={it.txs}
              />
            ))}
          </Card>
        </section>
      )}

      {/* 5. Recentemente Pagas */}
      {paidItems.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-foreground tracking-tight">Recentemente Pagas</h2>
          <Card className="mt-3 bg-card shadow-none border-border overflow-hidden divide-y divide-border">
            {paidItems.map(({ bill, account }) => (
              <CicloRow
                key={bill.id}
                account={account}
                status="paga"
                amount={bill.totalAmount}
                installmentCount={0}
                oneOffCount={0}
                compact
              />
            ))}
          </Card>
        </section>
      )}
    </div>
  );
};

/** Procura uma bill cuja due_date bate com o ciclo (mesmo mês/ano). */
function findBillForDue(
  bills: FinanceBill[],
  pluggyAccountId: string,
  targetDue: Date,
): FinanceBill | undefined {
  const ty = targetDue.getFullYear();
  const tm = targetDue.getMonth();
  return bills.find((b) => {
    if (b.pluggyAccountId !== pluggyAccountId || !b.dueDate) return false;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(b.dueDate);
    if (!m) return false;
    return Number(m[1]) === ty && Number(m[2]) - 1 === tm;
  });
}

export default Faturas;