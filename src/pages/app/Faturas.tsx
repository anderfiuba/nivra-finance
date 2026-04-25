import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  ArrowDownRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  RefreshCcw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useFinance, type FinanceBill } from "@/contexts/FinanceContext";
import { formatBRL, formatDate } from "@/lib/format";

/**
 * Faturas — detalhamento mês a mês dos cartões de crédito conectados via Pluggy.
 *
 * Fontes (todas reais, sem mock):
 *  - pluggy_accounts (type = CREDIT) → cartão, brand, last4, limite e vencimento.
 *  - pluggy_bills → faturas (mensais) com vencimento, total, mínimo, status.
 *  - pluggy_transactions → composição da fatura (compras avulsas vs parcelas).
 *
 * Associação fatura ↔ transações: a Pluggy não vincula bill_id à transação
 * em todos os conectores, então agrupamos pela janela
 * [bill anterior.due_date, bill atual.due_date]. Na ausência de bill anterior,
 * usamos os últimos 30 dias antes do vencimento.
 */

function billStatus(bill: FinanceBill): { label: string; tone: "ok" | "open" | "late" } {
  if (bill.paid) return { label: "Paga", tone: "ok" };
  if (!bill.dueDate) return { label: "Aberta", tone: "open" };
  const due = new Date(bill.dueDate + "T00:00:00");
  if (due.getTime() < Date.now()) return { label: "Vencida", tone: "late" };
  return { label: "Aberta", tone: "open" };
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00").getTime();
  return Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24));
}

const Faturas = () => {
  const { accounts, bills, transactions } = useFinance();

  const creditAccounts = useMemo(
    () => accounts.filter((a) => (a.type ?? "").toUpperCase() === "CREDIT"),
    [accounts],
  );

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    () => creditAccounts[0]?.id ?? "",
  );

  // Sincroniza seleção quando contas chegam pelo realtime.
  if (!selectedAccountId && creditAccounts.length > 0) {
    setTimeout(() => setSelectedAccountId(creditAccounts[0].id), 0);
  }

  const selectedAccount = creditAccounts.find((a) => a.id === selectedAccountId) ?? null;

  const accountBills = useMemo(() => {
    if (!selectedAccount) return [];
    return bills
      .filter((b) => b.pluggyAccountId === selectedAccount.pluggyAccountId)
      .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""));
  }, [bills, selectedAccount]);

  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const activeBill = useMemo(() => {
    if (selectedBillId) return accountBills.find((b) => b.id === selectedBillId) ?? null;
    return accountBills[0] ?? null;
  }, [selectedBillId, accountBills]);

  // Janela de transações da fatura ativa.
  const billTxs = useMemo(() => {
    if (!selectedAccount || !activeBill || !activeBill.dueDate) return [];
    const sortedAsc = [...accountBills].sort((a, b) =>
      (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
    );
    const idx = sortedAsc.findIndex((b) => b.id === activeBill.id);
    const previous = idx > 0 ? sortedAsc[idx - 1] : null;
    const end = new Date(activeBill.dueDate + "T23:59:59");
    const start = previous?.dueDate
      ? new Date(previous.dueDate + "T00:00:00")
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return transactions.filter((t) => {
      if (t.pluggyAccountId !== selectedAccount.pluggyAccountId) return false;
      const td = new Date(t.date).getTime();
      return td > start.getTime() && td <= end.getTime();
    });
  }, [selectedAccount, activeBill, accountBills, transactions]);

  // O tipo Transaction não carrega installmentNumber; usamos heurística por
  // descrição: padrão "x/y" indica parcela. Sem o padrão, é compra avulsa.
  // procuramos padrão "x/y" no description; se ausente, é avulsa.
  const installmentRegex = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/;
  const compras = billTxs.filter((t) => !installmentRegex.test(t.description));
  const parcelas = billTxs.filter((t) => installmentRegex.test(t.description));

  // Estado vazio (sem cartões conectados).
  if (creditAccounts.length === 0) {
    return (
      <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Faturas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Detalhamento das faturas do seu cartão de crédito mês a mês.
        </p>
        <Card className="mt-6 bg-gradient-card border-border p-12 text-center">
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

  const limit = selectedAccount?.creditLimit ?? null;
  const available = selectedAccount?.availableCreditLimit ?? null;
  const used = limit !== null && available !== null ? Math.max(0, limit - available) : null;
  const usedRatio = limit && limit > 0 && used !== null ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Faturas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Detalhamento mês a mês das faturas dos seus cartões — dados sincronizados via Open Finance.
          </p>
        </div>
        <Select value={selectedAccountId} onValueChange={(v) => { setSelectedAccountId(v); setSelectedBillId(null); }}>
          <SelectTrigger className="w-72 bg-input border-border">
            <SelectValue placeholder="Selecione um cartão" />
          </SelectTrigger>
          <SelectContent>
            {creditAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.marketingName || a.name}
                {a.cardNumberLast4 ? ` •••• ${a.cardNumberLast4}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-card border-border p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" /> Fatura atual
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground tabular-nums">
            {activeBill?.totalAmount !== null && activeBill?.totalAmount !== undefined
              ? formatBRL(activeBill.totalAmount)
              : selectedAccount
                ? formatBRL(selectedAccount.balance)
                : "—"}
          </p>
          {activeBill?.minimumPaymentAmount !== null && activeBill?.minimumPaymentAmount !== undefined && (
            <p className="mt-1 text-xs text-muted-foreground">
              Pagamento mínimo: {formatBRL(activeBill.minimumPaymentAmount)}
            </p>
          )}
        </Card>

        <Card className="bg-gradient-card border-border p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCcw className="h-3.5 w-3.5" /> Limite utilizado
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground tabular-nums">
            {used !== null ? formatBRL(used) : "—"}
            {limit !== null && (
              <span className="text-sm text-muted-foreground font-normal"> / {formatBRL(limit)}</span>
            )}
          </p>
          <Progress value={usedRatio} className="mt-3 h-1.5" />
          {available !== null && (
            <p className="mt-2 text-xs text-muted-foreground">Disponível: {formatBRL(available)}</p>
          )}
        </Card>

        <Card className="bg-gradient-card border-border p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> Próximo vencimento
          </div>
          {(() => {
            const due = activeBill?.dueDate ?? selectedAccount?.balanceDueDate ?? null;
            const days = daysUntil(due);
            return (
              <>
                <p className="mt-3 text-2xl font-bold text-foreground tabular-nums">
                  {due ? formatDate(due) : "—"}
                </p>
                {days !== null && (
                  <p
                    className={`mt-1 text-xs ${
                      days < 0
                        ? "text-destructive"
                        : days <= 3
                          ? "text-destructive"
                          : days <= 7
                            ? "text-warning"
                            : "text-muted-foreground"
                    }`}
                  >
                    {days < 0
                      ? `Vencida há ${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"}`
                      : days === 0
                        ? "Vence hoje"
                        : `Em ${days} ${days === 1 ? "dia" : "dias"}`}
                  </p>
                )}
              </>
            );
          })()}
        </Card>
      </div>

      {/* Histórico de faturas */}
      <Card className="bg-gradient-card border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Histórico</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Selecione uma fatura para ver o detalhamento.</p>
        </div>
        {accountBills.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhuma fatura sincronizada ainda. Aguarde a próxima sincronização ou
            {" "}<Link to="/app/conexoes" className="text-primary hover:underline">acione manualmente</Link>.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {accountBills.map((b) => {
              const status = billStatus(b);
              const isActive = (activeBill?.id ?? "") === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBillId(b.id)}
                  className={`w-full text-left p-4 md:p-5 hover:bg-secondary/30 transition-smooth flex items-center gap-4 ${
                    isActive ? "bg-secondary/40" : ""
                  }`}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Fatura • Vencimento {b.dueDate ? formatDate(b.dueDate) : "—"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-5 ${
                          status.tone === "ok"
                            ? "border-success/30 bg-success/10 text-success"
                            : status.tone === "late"
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-warning/30 bg-warning/10 text-warning"
                        }`}
                      >
                        {status.tone === "ok" ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <AlertCircle className="h-3 w-3 mr-1" />
                        )}
                        {status.label}
                      </Badge>
                      {b.minimumPaymentAmount !== null && (
                        <span className="text-xs text-muted-foreground">
                          Mínimo {formatBRL(b.minimumPaymentAmount)}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-foreground shrink-0 tabular-nums">
                    {b.totalAmount !== null ? formatBRL(b.totalAmount) : "—"}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Detalhamento da fatura ativa */}
      {activeBill && (
        <Card className="bg-gradient-card border-border overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">
              Detalhamento • {activeBill.dueDate ? formatDate(activeBill.dueDate) : "Fatura aberta"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {billTxs.length} {billTxs.length === 1 ? "lançamento" : "lançamentos"} no período.
            </p>
          </div>

          <div className="p-4 md:p-5">
            <Tabs defaultValue="avulsas">
              <TabsList>
                <TabsTrigger value="avulsas">Compras avulsas ({compras.length})</TabsTrigger>
                <TabsTrigger value="parcelas">Parcelas ({parcelas.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="avulsas" className="mt-4">
                {compras.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Sem compras avulsas neste período.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {compras.map((t) => (
                      <div key={t.id} className="flex items-center gap-4 py-3">
                        <div className="h-9 w-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                          <ArrowDownRight className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.category || "Sem categoria"} · {formatDate(t.date)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-destructive shrink-0">
                          −{formatBRL(t.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="parcelas" className="mt-4">
                {parcelas.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Sem parcelas neste período.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {parcelas.map((t) => {
                      const m = t.description.match(installmentRegex);
                      const inst = m ? `${m[1]}/${m[2]}` : null;
                      return (
                        <div key={t.id} className="flex items-center gap-4 py-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <RefreshCcw className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {inst && (
                                <Badge variant="outline" className="text-[10px] h-5 border-border bg-secondary/50">
                                  Parcela {inst}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {t.category || "Sem categoria"} · {formatDate(t.date)}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-destructive shrink-0">
                            −{formatBRL(t.value)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Faturas;