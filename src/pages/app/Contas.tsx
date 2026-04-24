import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { Plus, Wallet } from "lucide-react";

const Contas = () => {
  const total = 0;
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
        <p className="mt-1 text-xs text-muted-foreground">Os saldos aparecerão após a primeira sincronização real.</p>
      </Card>

      <Card className="bg-gradient-card border-border p-10 flex flex-col items-center text-center">
        <div className="h-14 w-14 rounded-full bg-secondary/60 flex items-center justify-center mb-4">
          <Wallet className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Nenhum saldo disponível ainda</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Assim que as contas conectadas forem sincronizadas com sucesso, esta tela exibirá os saldos reais por instituição.
        </p>
      </Card>
    </div>
  );
};

export default Contas;
