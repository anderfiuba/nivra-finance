import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownRight, ArrowUpRight, Brain, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { PieChart, ResponsiveContainer, Tooltip, Pie, Cell } from "recharts";
import { formatBRL } from "@/lib/format";
import { useFinance } from "@/contexts/FinanceContext";
import { useAuth } from "@/contexts/AuthContext";

const pctChange = (curr: number, prev: number): { label: string; positive: boolean } => {
  if (prev === 0) return { label: curr === 0 ? "0%" : "+100%", positive: curr >= 0 };
  const diff = ((curr - prev) / Math.abs(prev)) * 100;
  const rounded = Math.round(diff * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return { label: `${sign}${rounded.toLocaleString("pt-BR")}%`, positive: rounded >= 0 };
};

const Dashboard = () => {
  const { displayName } = useAuth();
  const {
    cycleTransactions,
    cycleTotals,
    previousCycleTotals,
    expensesByCategoryCycle,
    currentCycleLabel,
  } = useFinance();

  const recent = [...cycleTransactions]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 6);

  const consolidated = 0;
  const trendEntradas = pctChange(cycleTotals.entradas, previousCycleTotals.entradas);
  const trendSaidas = pctChange(cycleTotals.saidas, previousCycleTotals.saidas);
  const trendSaldo = pctChange(cycleTotals.saldo, previousCycleTotals.saldo);

  const kpis = [
    { label: "Saldo consolidado", value: consolidated, icon: Wallet, trend: cycleTransactions.length ? trendSaldo.label : "0%", positive: true },
    { label: "Entradas no ciclo", value: cycleTotals.entradas, icon: ArrowUpRight, trend: trendEntradas.label, positive: trendEntradas.positive },
    { label: "Saídas no ciclo", value: cycleTotals.saidas, icon: ArrowDownRight, trend: trendSaidas.label, positive: !trendSaidas.positive },
    { label: "Saldo do ciclo", value: cycleTotals.saldo, icon: TrendingUp, trend: trendSaldo.label, positive: trendSaldo.positive },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Olá, {displayName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão consolidada do ciclo <span className="text-foreground font-medium">{currentCycleLabel}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="bg-gradient-card border-border p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{formatBRL(kpi.value)}</p>
                <p className={`mt-1 text-xs ${kpi.positive ? "text-success" : "text-destructive"}`}>
                  {kpi.trend} vs ciclo anterior
                </p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <kpi.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-gradient-card border-border p-6 lg:col-span-2">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Evolução do saldo</h3>
              <p className="text-xs text-muted-foreground mt-1">Últimos 6 meses</p>
            </div>
            <Badge variant="outline" className="border-border bg-secondary/50 text-muted-foreground">Aguardando dados</Badge>
          </div>
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground text-center">
            O gráfico será exibido assim que as transações reais forem sincronizadas.
          </div>
        </Card>

        <Card className="bg-gradient-card border-border p-6">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground">Despesas por categoria</h3>
            <p className="text-xs text-muted-foreground mt-1">Distribuição em {currentCycleLabel}</p>
          </div>
          {expensesByCategoryCycle.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
              Sem despesas neste ciclo.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={expensesByCategoryCycle} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {expensesByCategoryCycle.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="hsl(var(--card))" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => formatBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {expensesByCategoryCycle.slice(0, 4).map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      <span className="text-muted-foreground">{c.name}</span>
                    </div>
                    <span className="text-foreground font-medium">{formatBRL(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-gradient-card border-border p-6 lg:col-span-2">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground">Receitas vs Despesas</h3>
            <p className="text-xs text-muted-foreground mt-1">Comparativo mensal</p>
          </div>
          <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground text-center">
            O comparativo mensal aparecerá quando houver histórico suficiente de lançamentos reais.
          </div>
        </Card>

        <Card className="bg-gradient-card border-border p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Brain className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                Insights com IA <Sparkles className="h-3.5 w-3.5 text-accent" />
              </h3>
              <p className="text-xs text-muted-foreground">Análise do ciclo {currentCycleLabel}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
            Ainda não há dados suficientes para gerar insights confiáveis.
          </div>
        </Card>
      </div>

      <Card className="bg-gradient-card border-border p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-foreground">Movimentações recentes</h3>
            <p className="text-xs text-muted-foreground mt-1">Últimas transações do ciclo atual</p>
          </div>
        </div>
        <div className="space-y-2">
          {recent.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Sem movimentações neste ciclo.</p>
          )}
          {recent.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/40 transition-smooth">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${t.type === "entrada" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {t.type === "entrada" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{t.category || "Sem categoria"} · {t.account}</p>
                </div>
              </div>
              <p className={`text-sm font-semibold ${t.type === "entrada" ? "text-success" : "text-foreground"}`}>
                {t.value > 0 ? "+" : ""}{formatBRL(t.value)}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
