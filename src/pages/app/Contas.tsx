import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { accounts } from "@/data/mockData";
import { formatBRL } from "@/lib/format";
import { Plus, RefreshCw, Wallet } from "lucide-react";

const statusMap: Record<string, { label: string; cls: string }> = {
  ativa: { label: "Ativa", cls: "border-success/40 text-success bg-success/10" },
  pendente: { label: "Pendente", cls: "border-warning/40 text-warning bg-warning/10" },
  desconectada: { label: "Desconectada", cls: "border-destructive/40 text-destructive bg-destructive/10" },
};

const Contas = () => {
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Contas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Todas as suas contas conectadas em um só lugar.</p>
        </div>
        <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant">
          <Plus className="h-4 w-4 mr-2" /> Adicionar conta
        </Button>
      </div>

      <Card className="bg-gradient-card border-border p-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Saldo total consolidado</p>
        <p className="mt-2 text-4xl font-bold text-foreground">{formatBRL(total)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{accounts.length} contas conectadas</p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((a) => (
          <Card key={a.id} className="bg-gradient-card border-border p-5 hover:border-primary/40 transition-smooth">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-lg flex items-center justify-center text-white font-semibold text-sm" style={{ background: a.color }}>
                  {a.bank.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{a.bank}</h3>
                  <p className="text-xs text-muted-foreground">{a.type}</p>
                </div>
              </div>
              <Badge variant="outline" className={statusMap[a.status]?.cls || ""}>
                {statusMap[a.status]?.label || a.status}
              </Badge>
            </div>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Saldo atual</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{formatBRL(a.balance)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3" /> {a.lastSync}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Contas;
