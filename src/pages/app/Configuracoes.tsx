import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { CalendarRange, Moon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFinance } from "@/contexts/FinanceContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatCycleLabel, getCycleRange } from "@/lib/cycle";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { PrivacyDataCard } from "@/components/configuracoes/PrivacyDataCard";

const REFERENCE_DATE = new Date();

const Configuracoes = () => {
  const { cycleDay, setCycleDay } = useFinance();
  const { displayName, user } = useAuth();
  const [draftDay, setDraftDay] = useState<string>(String(cycleDay));
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDraftDay(String(cycleDay));
  }, [cycleDay]);

  const previewLabel = useMemo(() => {
    const n = Number(draftDay);
    if (!Number.isFinite(n)) return "—";
    const safe = Math.max(1, Math.min(28, Math.floor(n)));
    return formatCycleLabel(getCycleRange(safe, REFERENCE_DATE));
  }, [draftDay]);

  const handleSaveCycle = () => {
    const n = Number(draftDay);
    if (!Number.isFinite(n) || n < 1 || n > 28) {
      toast.error("Escolha um dia entre 1 e 28.");
      return;
    }
    setCycleDay(n);
    toast.success("Ciclo financeiro atualizado");
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie sua conta, segurança e preferências.</p>
      </div>

      <Card className="bg-gradient-card border-border p-6">
        <h3 className="text-base font-semibold text-foreground">Perfil</h3>
        <p className="text-xs text-muted-foreground mt-1">Informações da sua conta.</p>
        <Separator className="my-5" />
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" value={displayName} readOnly className="bg-input border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={user?.email ?? ""} readOnly className="bg-input border-border" />
          </div>
        </div>
        <div className="mt-6">
          <Button variant="outline" disabled>Perfil sincronizado pela autenticação</Button>
        </div>
      </Card>

      <Card className="bg-gradient-card border-border p-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarRange className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Ciclo financeiro</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Defina o dia de fechamento do seu mês financeiro. Ideal para alinhar com o vencimento do cartão ou contas principais.
            </p>
          </div>
        </div>
        <Separator className="my-5" />
        <div className="grid md:grid-cols-2 gap-5 items-end">
          <div className="space-y-2">
            <Label htmlFor="cycleDay">Dia de fechamento</Label>
            <Input
              id="cycleDay"
              type="number"
              min={1}
              max={28}
              value={draftDay}
              onChange={(e) => setDraftDay(e.target.value)}
              className="bg-input border-border"
            />
            <p className="text-xs text-muted-foreground">Escolha um dia entre 1 e 28.</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Período atual</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{previewLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Dashboard, comparativos e insights passam a usar este recorte.
            </p>
          </div>
        </div>
        <div className="mt-6">
          <Button
            className="bg-gradient-primary text-primary-foreground hover:opacity-90"
            onClick={handleSaveCycle}
          >
            Salvar ciclo
          </Button>
        </div>
      </Card>

      <Card className="bg-gradient-card border-border p-6">
        <h3 className="text-base font-semibold text-foreground">Segurança</h3>
        <p className="text-xs text-muted-foreground mt-1">Mantenha sua conta protegida.</p>
        <Separator className="my-5" />
        <div className="space-y-5">
          {[
            { title: "Autenticação em dois fatores", desc: "Adicione uma camada extra de segurança ao seu login.", on: true },
            { title: "Alertas de novo dispositivo", desc: "Seja notificado quando alguém acessar sua conta de um novo aparelho.", on: true },
            { title: "Bloqueio automático", desc: "Solicitar senha após 15 minutos de inatividade.", on: false },
          ].map((item, i) => (
            <div key={i} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <Switch defaultChecked={item.on} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="bg-gradient-card border-border p-6">
        <h3 className="text-base font-semibold text-foreground">Preferências</h3>
        <p className="text-xs text-muted-foreground mt-1">Personalize sua experiência.</p>
        <Separator className="my-5" />
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Moon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Modo escuro</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Use uma aparência escura para ambientes com pouca luz. O modo claro é o padrão.
                </p>
              </div>
            </div>
            {mounted ? (
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
                aria-label="Alternar modo escuro"
              />
            ) : (
              <Switch checked={false} disabled aria-label="Alternar modo escuro" />
            )}
          </div>
          {[
            { title: "Resumo semanal por e-mail", desc: "Receba um panorama financeiro toda segunda-feira.", on: true },
            { title: "Insights de IA em tempo real", desc: "Notificações instantâneas para anomalias e oportunidades.", on: true },
          ].map((item, i) => (
            <div key={i} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <Switch defaultChecked={item.on} />
            </div>
          ))}
        </div>
      </Card>

      <PrivacyDataCard />
    </div>
  );
};

export default Configuracoes;
