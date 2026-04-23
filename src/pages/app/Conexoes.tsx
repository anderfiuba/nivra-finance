import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { connections } from "@/data/mockData";
import { CheckCircle2, Plus, RefreshCw, ShieldCheck, AlertTriangle, Lock } from "lucide-react";

const Conexoes = () => {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Conexões Open Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie integrações bancárias com total transparência e segurança.</p>
        </div>
        <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant">
          <Plus className="h-4 w-4 mr-2" /> Nova conexão
        </Button>
      </div>

      <Card className="bg-gradient-card border-border p-5 flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5 text-success" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Padrão regulado pelo Banco Central</h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            O Nivra utiliza o padrão Open Finance Brasil. Todos os dados trafegam de forma criptografada e a Nivra possui apenas permissão de leitura — jamais movimenta valores em sua conta.
          </p>
        </div>
        <Lock className="h-4 w-4 text-success shrink-0" />
      </Card>

      <div className="space-y-3">
        {connections.map((c) => (
          <Card key={c.id} className="bg-gradient-card border-border p-5 flex items-center gap-4 flex-wrap">
            <div className="h-11 w-11 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
              <span className="font-semibold text-foreground text-sm">{c.bank.substring(0, 2).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-foreground">{c.bank}</h3>
                {c.status === "conectado" ? (
                  <Badge variant="outline" className="border-success/40 text-success bg-success/10">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Reautenticar
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3" /> Última sincronização {c.lastSync}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {c.scopes.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs h-5 border-border bg-secondary/50">{s}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" size="sm">Sincronizar</Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Remover</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Conexoes;
