import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { Plus, Wallet, Loader2, CreditCard } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { Link } from "react-router-dom";

const Contas = () => {
  const { accounts, totalBalance, isLoading } = useFinance();

  const creditCards = accounts.filter((a) => (a.type ?? "").toUpperCase() === "CREDIT");
  const bankAccounts = accounts.filter((a) => (a.type ?? "").toUpperCase() !== "CREDIT");

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Contas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Todas as suas contas conectadas em um só lugar.</p>
        </div>
        <Button asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant">
          <Link to="/app/conexoes"><Plus className="h-4 w-4 mr-2" /> Adicionar conta</Link>
        </Button>
      </div>

      <Card className="bg-gradient-card border-border p-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Saldo total consolidado</p>
        <p className="mt-2 text-4xl font-bold text-foreground">{formatBRL(totalBalance)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Soma dos saldos bancários menos o total das faturas de cartão em aberto.
        </p>
      </Card>

      {isLoading && accounts.length === 0 ? (
        <Card className="bg-gradient-card border-border p-10 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Carregando contas…</span>
        </Card>
      ) : accounts.length === 0 ? (
        <Card className="bg-gradient-card border-border p-10 flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-full bg-secondary/60 flex items-center justify-center mb-4">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Nenhuma conta sincronizada ainda</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Conecte uma conta em <strong>Conexões Open Finance</strong> para visualizar saldos reais aqui.
          </p>
          <Button asChild className="mt-5">
            <Link to="/app/conexoes"><Plus className="h-4 w-4 mr-2" /> Conectar conta</Link>
          </Button>
        </Card>
      ) : (
        <>
          {creditCards.length > 0 && (
            <Card className="bg-gradient-card border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Cartões de Crédito</h2>
                <span className="text-xs text-muted-foreground">{creditCards.length}</span>
              </div>
              <div className="divide-y divide-border">
                {creditCards.map((acc) => {
                  const used = Math.abs(acc.balance ?? 0);
                  const limit = acc.creditLimit ?? null;
                  const pct = limit && limit > 0 ? Math.min(100, (used / limit) * 100) : null;
                  return (
                    <div key={acc.id} className="py-3 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{acc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {acc.cardBrand ?? "Cartão"}
                          {acc.cardNumberLast4 ? ` · final ${acc.cardNumberLast4}` : ""}
                          {acc.balanceDueDate ? ` · vence ${new Date(acc.balanceDueDate).toLocaleDateString("pt-BR")}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0 min-w-[180px]">
                        <p className="text-sm font-bold text-destructive">{formatBRL(used)}</p>
                        {pct !== null && (
                          <>
                            <div className="mt-1 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-destructive" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {pct.toFixed(1)}% · Limite: {formatBRL(limit!)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {bankAccounts.length > 0 && (
            <Card className="bg-gradient-card border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Contas Bancárias</h2>
                <span className="text-xs text-muted-foreground">{bankAccounts.length}</span>
              </div>
              <div className="divide-y divide-border">
                {bankAccounts.map((acc) => (
                  <div key={acc.id} className="py-3 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">{acc.subtype ?? acc.type ?? "Conta"}</p>
                    </div>
                    <p className="text-sm font-bold text-foreground shrink-0">{formatBRL(acc.balance)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default Contas;
