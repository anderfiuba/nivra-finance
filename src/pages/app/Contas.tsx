import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Wallet, Loader2 } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { Link } from "react-router-dom";
import { AccountGroupCard } from "@/components/contas/AccountGroupCard";
import { AccountRow } from "@/components/contas/AccountRow";
import { ConnectionRow } from "@/components/contas/ConnectionRow";
import { InvestmentRow } from "@/components/contas/InvestmentRow";

const Contas = () => {
  const { accounts, items, transactions, investments, investmentsTotal, isLoading, refresh } = useFinance();

  const creditCards = accounts.filter((a) => (a.type ?? "").toUpperCase() === "CREDIT");
  const bankAccounts = accounts.filter((a) => (a.type ?? "").toUpperCase() !== "CREDIT");

  // Heurística para conectores não-Open-Finance (ex: Mercado Pago) que entregam
  // saldo zero apesar de existir movimento. Usamos um sinal observável sem
  // depender de bandeira por conector: se o saldo da conta BANK é exatamente 0
  // E houve movimentação nos últimos 30 dias, sinalizamos como provavelmente
  // incompleto. Não causa falso-positivo para contas legitimamente zeradas
  // que ficaram inativas.
  const incompleteFlags = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const moved = new Set<string>();
    for (const t of transactions) {
      if (!t.pluggyAccountId) continue;
      if (new Date(t.date).getTime() >= cutoff) moved.add(t.pluggyAccountId);
    }
    const flags: Record<string, boolean> = {};
    for (const a of bankAccounts) {
      const balZero = (a.balance ?? 0) === 0 && (a.automaticallyInvestedBalance ?? 0) === 0;
      flags[a.id] = balZero && moved.has(a.pluggyAccountId);
    }
    return flags;
  }, [bankAccounts, transactions]);

  /**
   * Mapeia pluggy_item_id → { isPartial, missing[] } para sinalizar nas
   * contas que vieram de uma conexão com sincronização parcial — caso típico
   * em que o usuário não autorizou o produto TRANSACTIONS no consentimento
   * do banco (Inter, Bradesco etc.).
   */
  const itemPartialMap = useMemo(() => {
    const labels: Record<string, string> = {
      accounts: "Contas",
      transactions: "Transações",
      creditCards: "Cartões",
      investments: "Investimentos",
      loans: "Empréstimos",
      identity: "Dados cadastrais",
      paymentData: "Dados de pagamento",
      incomeReports: "Comprovantes de renda",
    };
    const map = new Map<string, { isPartial: boolean; missing: string[] }>();
    for (const it of items) {
      const isPartial = (it.executionStatus ?? "") === "PARTIAL_SUCCESS";
      const missing: string[] = [];
      if (isPartial && it.statusDetail && typeof it.statusDetail === "object") {
        for (const [key, raw] of Object.entries(it.statusDetail)) {
          if (!raw || typeof raw !== "object") continue;
          const v = raw as { isUpdated?: boolean; warnings?: unknown[]; errors?: unknown[] };
          const failed =
            v.isUpdated === false ||
            (Array.isArray(v.errors) && v.errors.length > 0) ||
            (Array.isArray(v.warnings) && v.warnings.length > 0);
          if (failed) missing.push(labels[key] ?? key);
        }
      }
      map.set(it.pluggyItemId, { isPartial, missing });
    }
    return map;
  }, [items]);

  const partialPropsFor = (pluggyItemId: string | null) => {
    if (!pluggyItemId) return { partialSync: false, missingProducts: undefined };
    const meta = itemPartialMap.get(pluggyItemId);
    return {
      partialSync: meta?.isPartial ?? false,
      missingProducts: meta?.missing,
    };
  };

  // Total de cartões = soma das dívidas (saldo absoluto)
  const creditTotal = creditCards.reduce((sum, a) => sum + Math.abs(a.balance ?? 0), 0);
  // Total contas = soma direta dos saldos
  const bankTotal = bankAccounts.reduce((sum, a) => sum + (a.balance ?? 0), 0);

  const hasAnything = accounts.length > 0 || items.length > 0 || investments.length > 0;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Contas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suas contas e cartões agrupados por tipo.
          </p>
        </div>
        <Button
          asChild
          className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant"
        >
          <Link to="/app/conexoes">
            <Plus className="h-4 w-4 mr-2" /> Adicionar conta
          </Link>
        </Button>
      </div>

      {isLoading && !hasAnything ? (
        <Card className="bg-gradient-card border-border p-10 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Carregando contas…</span>
        </Card>
      ) : !hasAnything ? (
        <Card className="bg-gradient-card border-border p-10 flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-full bg-secondary/60 flex items-center justify-center mb-4">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            Nenhuma conta sincronizada ainda
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Conecte uma conta em <strong>Conexões Open Finance</strong> para visualizar saldos
            reais aqui.
          </p>
          <Button asChild className="mt-5">
            <Link to="/app/conexoes">
              <Plus className="h-4 w-4 mr-2" /> Conectar conta
            </Link>
          </Button>
        </Card>
      ) : (
        <>
          {creditCards.length > 0 && (
            <AccountGroupCard
              title="Cartões de Crédito"
              count={creditCards.length}
              totalTone="negative"
              totalSigned
              totalValue={creditTotal}
            >
              {creditCards.map((acc) => (
                <AccountRow
                  key={acc.id}
                  account={acc}
                  variant="credit"
                  {...partialPropsFor(acc.pluggyItemId)}
                />
              ))}
            </AccountGroupCard>
          )}

          {bankAccounts.length > 0 && (
            <AccountGroupCard
              title="Contas Bancárias"
              count={bankAccounts.length}
              totalTone="positive"
              totalValue={bankTotal}
            >
              {bankAccounts.map((acc) => (
                <AccountRow
                  key={acc.id}
                  account={acc}
                  variant="bank"
                  balanceLikelyIncomplete={incompleteFlags[acc.id]}
                  {...partialPropsFor(acc.pluggyItemId)}
                />
              ))}
            </AccountGroupCard>
          )}

          {investments.length > 0 && (
            <AccountGroupCard
              title="Investimentos"
              count={investments.length}
              totalTone="positive"
              totalValue={investmentsTotal}
            >
              {investments.map((inv) => (
                <InvestmentRow key={inv.id} investment={inv} />
              ))}
            </AccountGroupCard>
          )}

          {items.length > 0 && (
            <AccountGroupCard title="Conexões" count={items.length}>
              {items.map((it) => (
                <ConnectionRow key={it.id} item={it} onRemoved={refresh} />
              ))}
            </AccountGroupCard>
          )}
        </>
      )}
    </div>
  );
};

export default Contas;
