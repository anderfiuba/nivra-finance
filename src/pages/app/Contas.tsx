import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { Plus, Wallet, Loader2 } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { Link } from "react-router-dom";

const Contas = () => {
  const { accounts, totalBalance, isLoading } = useFinance();
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
          Soma dos saldos de todas as contas conectadas via Open Finance.
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <Card key={acc.id} className="bg-gradient-card border-border p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">{acc.name}</h3>
                  <p className="text-xs text-muted-foreground">{acc.type ?? "Conta"}</p>
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-foreground">{formatBRL(acc.balance)}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Contas;
