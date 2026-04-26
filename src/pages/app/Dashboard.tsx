import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  Wallet,
  PieChart as PieIcon,
  Receipt,
  Target,
  Clock,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { formatBRL } from "@/lib/format";
import { useFinance } from "@/contexts/FinanceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const pctChange = (curr: number, prev: number): { label: string; positive: boolean } => {
  if (prev === 0) return { label: curr === 0 ? "0%" : "+100%", positive: curr >= 0 };
  const diff = ((curr - prev) / Math.abs(prev)) * 100;
  const rounded = Math.round(diff * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return { label: `${sign}${rounded.toLocaleString("pt-BR")}%`, positive: rounded >= 0 };
};

const Dashboard = () => {
  const { displayName } = useAuth();
  const isMobile = useIsMobile();
  const {
    monthTransactions,
    monthTotals,
    previousMonthTotals,
    expensesByCategoryMonth,
    currentMonthLabel,
    patrimonyHistory,
    netWorth,
    accounts,
    bills,
    budgetProgress,
  } = useFinance();

  const trendEntradas = pctChange(monthTotals.entradas, previousMonthTotals.entradas);
  const trendSaidas = pctChange(monthTotals.saidas, previousMonthTotals.saidas);
  const trendSaldo = pctChange(monthTotals.saldo, previousMonthTotals.saldo);

  const recent = useMemo(
    () =>
      [...monthTransactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8),
    [monthTransactions],
  );

  // Faturas em aberto (não pagas).
  // Prioriza vencimentos no mês civil corrente; se não houver, mostra as próximas
  // 3 faturas em aberto (mais próximas) — assim o card nunca fica vazio quando
  // o cliente ainda tem fatura por fechar/vencer.
  const openBills = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const inMonth = bills.filter((b) => {
      if (b.effectivePaid) return false;
      if (!b.dueDate) return false;
      const d = new Date(b.dueDate);
      return d.getFullYear() === y && d.getMonth() === m;
    });
    if (inMonth.length > 0) return inMonth;
    // Fallback: próximas faturas em aberto a partir de hoje.
    return bills
      .filter((b) => !b.effectivePaid && b.dueDate && new Date(b.dueDate) >= now)
      .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
      .slice(0, 3);
  }, [bills]);

  const openBillsTotal = openBills.reduce((s, b) => s + (b.totalAmount ?? 0), 0);

  const accountByPluggyId = useMemo(() => {
    const map = new Map<string, (typeof accounts)[number]>();
    for (const a of accounts) map.set(a.pluggyAccountId, a);
    return map;
  }, [accounts]);

  // Top orçamentos: critical first.
  const topBudgets = useMemo(() => {
    const order = { over: 0, alert: 1, ok: 2 } as const;
    return [...budgetProgress]
      .sort((a, b) => order[a.status] - order[b.status] || b.ratio - a.ratio)
      .slice(0, 4);
  }, [budgetProgress]);

  const donutInner = isMobile ? 42 : 55;
  const donutOuter = isMobile ? 65 : 85;
  const donutHeight = isMobile ? 180 : 220;

  // Histórico do patrimônio — apenas últimos 90 dias (≈ 3 meses).
  const patrimonySeries = useMemo(() => {
    return patrimonyHistory.map((p) => {
      const d = new Date(p.date);
      return {
        date: p.date,
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        value: p.value,
      };
    });
  }, [patrimonyHistory]);

  const patrimonyHasMovement = useMemo(() => {
    if (patrimonySeries.length < 2) return false;
    const min = Math.min(...patrimonySeries.map((p) => p.value));
    const max = Math.max(...patrimonySeries.map((p) => p.value));
    return Math.abs(max - min) > 0.01;
  }, [patrimonySeries]);

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl md:text-3xl font-bold text-foreground tracking-tight">
          Olá, {displayName}
        </h1>
        <p className="mt-1 text-xs md:text-sm text-muted-foreground">
          Visão consolidada de{" "}
          <span className="text-foreground font-medium capitalize">{currentMonthLabel}</span>.
        </p>
      </div>

      {/* Pocket: "Quanto posso gastar este mês?" — atalho principal mobile */}

      {/* Patrimônio em destaque (full-width) + KPIs do mês */}
      <PatrimonyHeroCard value={netWorth} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <KPI
          label="Entradas no mês"
          value={monthTotals.entradas}
          icon={ArrowUpRight}
          tone="success"
          trend={trendEntradas.label}
          trendPositive={trendEntradas.positive}
        />
        <KPI
          label="Saídas no mês"
          value={monthTotals.saidas}
          icon={ArrowDownRight}
          tone="destructive"
          trend={trendSaidas.label}
          trendPositive={!trendSaidas.positive}
        />
        <KPI
          label="Resultado do mês"
          value={monthTotals.saldo}
          icon={TrendingUp}
          tone={monthTotals.saldo >= 0 ? "success" : "destructive"}
          trend={trendSaldo.label}
          trendPositive={trendSaldo.positive}
          showSign
        />
      </div>

      {/* Histórico do Patrimônio (últimos 3 meses) */}
      <Card className="bg-gradient-card border-border p-4 md:p-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4 text-primary" />
            <h3 className="text-[11px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Histórico do Patrimônio
            </h3>
          </div>
          <span className="text-[10px] md:text-xs text-muted-foreground">Últimos 3 meses</span>
        </div>
        {patrimonySeries.length === 0 ? (
          <div className="h-[180px] md:h-[220px] flex items-center justify-center text-xs text-muted-foreground">
            Sem contas conectadas para calcular o histórico.
          </div>
        ) : !patrimonyHasMovement ? (
          <div className="h-[180px] md:h-[220px] flex items-center justify-center text-xs text-muted-foreground text-center px-4">
            Sem variação de patrimônio nos últimos 3 meses. O gráfico aparecerá conforme novas movimentações forem sincronizadas.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={isMobile ? 180 : 240}>
            <AreaChart data={patrimonySeries} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="patrimonyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                interval={Math.max(0, Math.floor(patrimonySeries.length / (isMobile ? 4 : 8)))}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v.toFixed(0)}`
                }
                width={60}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [formatBRL(v), "Patrimônio"]}
                labelFormatter={(l: string) => `Em ${l}`}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#patrimonyGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Categorias + Orçamentos + Faturas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Categorias */}
        <Card className="bg-gradient-card border-border p-4 md:p-6 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary" />
              <h3 className="text-sm md:text-base font-semibold text-foreground">
                Principais categorias
              </h3>
            </div>
            <Link
              to="/app/categorizacao"
              className="text-xs text-primary hover:underline"
            >
              Ver mais →
            </Link>
          </div>
          {expensesByCategoryMonth.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground text-center">
              Sem despesas neste mês.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={donutHeight}>
                <PieChart>
                  <Pie
                    data={expensesByCategoryMonth}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={donutInner}
                    outerRadius={donutOuter}
                    paddingAngle={2}
                  >
                    {expensesByCategoryMonth.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.color}
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => formatBRL(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {expensesByCategoryMonth.slice(0, 4).map((c) => {
                  const total = expensesByCategoryMonth.reduce((s, x) => s + x.value, 0);
                  const pct = total > 0 ? Math.round((c.value / total) * 100) : 0;
                  return (
                    <div key={c.name} className="flex items-center justify-between text-xs md:text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: c.color }}
                        />
                        <span className="text-muted-foreground truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-foreground font-medium tabular-nums">
                          {formatBRL(c.value)}
                        </span>
                        <span className="text-muted-foreground text-[11px] tabular-nums w-9 text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        {/* Orçamentos */}
        <Card className="bg-gradient-card border-border p-4 md:p-6 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="text-sm md:text-base font-semibold text-foreground">
                Orçamentos do mês
              </h3>
            </div>
            <Link
              to="/app/categorizacao"
              className="text-xs text-primary hover:underline"
            >
              Gerenciar →
            </Link>
          </div>
          {topBudgets.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs md:text-sm text-muted-foreground">
                Você ainda não definiu limites por categoria.
              </p>
              <Link
                to="/app/categorizacao"
                className="mt-3 inline-block text-xs text-primary hover:underline"
              >
                Definir orçamentos →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {topBudgets.map((b) => {
                const pct = Math.min(100, Math.round(b.ratio * 100));
                const toneClass =
                  b.status === "over"
                    ? "text-destructive"
                    : b.status === "alert"
                      ? "text-warning"
                      : "text-success";
                return (
                  <div key={b.budgetId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs md:text-sm gap-2">
                      <span className="text-foreground truncate">
                        {b.scope === "child" && b.parentCategoryLabel ? (
                          <>
                            <span className="text-muted-foreground">{b.parentCategoryLabel} ›</span>{" "}
                            {b.categoryLabel}
                          </>
                        ) : (
                          b.categoryLabel
                        )}
                      </span>
                      <span className={cn("font-medium tabular-nums shrink-0", toneClass)}>
                        {pct}%
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                      <span>{formatBRL(b.spent)}</span>
                      <span>de {formatBRL(b.limit)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Faturas */}
        <Card className="bg-gradient-card border-border p-4 md:p-6 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <h3 className="text-sm md:text-base font-semibold text-foreground">
                Faturas do mês
              </h3>
            </div>
            <Link to="/app/faturas" className="text-xs text-primary hover:underline">
              Ver todas →
            </Link>
          </div>
          {openBills.length === 0 ? (
            <div className="py-6 text-center text-xs md:text-sm text-muted-foreground">
              Nenhuma fatura em aberto neste mês.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-2xl md:text-3xl font-bold text-foreground tabular-nums">
                  {formatBRL(openBillsTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {openBills.length} {openBills.length === 1 ? "fatura" : "faturas"} em aberto
                </p>
              </div>
              <div className="space-y-2 pt-2 border-t border-border">
                {openBills.slice(0, 3).map((b) => {
                  const acc = accountByPluggyId.get(b.pluggyAccountId);
                  return (
                    <div
                      key={b.id}
                      className="flex items-center justify-between text-xs md:text-sm gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-foreground truncate">
                          {acc?.name ?? "Cartão"}
                        </p>
                        {b.dueDate && (
                          <p className="text-[11px] text-muted-foreground">
                            Vence {new Date(b.dueDate).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </p>
                        )}
                      </div>
                      <span className="text-foreground font-semibold tabular-nums shrink-0">
                        {formatBRL(b.totalAmount ?? 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Movimentações recentes */}
      <Card className="bg-gradient-card border-border p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm md:text-base font-semibold text-foreground">
              Movimentações recentes
            </h3>
            <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
              Últimas transações do mês
            </p>
          </div>
          <Link to="/app/extrato" className="text-xs text-primary hover:underline">
            Ver todas →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-xs md:text-sm text-muted-foreground text-center py-6">
            Sem movimentações neste mês.
          </p>
        ) : (
          <div className="divide-y divide-border md:divide-y-0 md:space-y-1">
            {recent.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 py-2.5 md:py-2 md:px-3 md:rounded-lg md:hover:bg-secondary/40 transition-smooth"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      "h-8 w-8 md:h-9 md:w-9 rounded-lg flex items-center justify-center shrink-0",
                      t.type === "entrada"
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {t.type === "entrada" ? (
                      <ArrowUpRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium text-foreground truncate">
                      {t.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {t.category && (
                        <Badge
                          variant="outline"
                          className="border-border bg-secondary/40 text-[10px] md:text-xs px-1.5 py-0 h-4 md:h-5 font-normal"
                        >
                          {t.category}
                        </Badge>
                      )}
                      <span className="text-[10px] md:text-xs text-muted-foreground truncate">
                        {t.account}
                      </span>
                    </div>
                  </div>
                </div>
                <p
                  className={cn(
                    "text-xs md:text-sm font-semibold tabular-nums shrink-0",
                    t.type === "entrada" ? "text-success" : "text-foreground",
                  )}
                >
                  {t.type === "saida" ? "−" : "+"}
                  {formatBRL(Math.abs(t.value))}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Rodapé: aviso de sync automática */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-2">
        <Clock className="h-3 w-3" />
        <span>
          Atualizamos seus dados automaticamente 2× ao dia (00:00 e 12:00 BRT).
        </span>
      </div>
    </div>
  );
};

interface KPIProps {
  label: string;
  subtitle?: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "destructive";
  trend?: string;
  trendPositive?: boolean;
  showSign?: boolean;
}

function KPI({ label, subtitle, value, icon: Icon, tone, trend, trendPositive, showSign }: KPIProps) {
  const toneClass =
    tone === "success"
      ? "text-success bg-success/10"
      : tone === "destructive"
        ? "text-destructive bg-destructive/10"
        : "text-primary bg-primary/10";
  const valueClass =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : "text-foreground";
  const sign = showSign && value > 0 ? "+" : showSign && value < 0 ? "−" : "";
  return (
    <Card className="bg-gradient-card border-border p-3 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </p>
          <p className={cn("mt-1 md:mt-2 text-base md:text-2xl font-bold tabular-nums", valueClass)}>
            {sign}
            {formatBRL(Math.abs(value))}
          </p>
          {trend ? (
            <p
              className={cn(
                "mt-0.5 md:mt-1 text-[10px] md:text-xs",
                trendPositive ? "text-success" : "text-destructive",
              )}
            >
              {trend} vs anterior
            </p>
          ) : subtitle ? (
            <p className="mt-0.5 md:mt-1 text-[10px] md:text-xs text-muted-foreground truncate">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className={cn("h-7 w-7 md:h-9 md:w-9 rounded-lg flex items-center justify-center shrink-0", toneClass)}>
          <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
        </div>
      </div>
    </Card>
  );
}

function PatrimonyHeroCard({ value }: { value: number }) {
  return (
    <Card className="relative overflow-hidden border-border p-5 md:p-7 bg-gradient-primary text-primary-foreground">
      <div
        className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-foreground/10 blur-2xl"
        aria-hidden="true"
      />
      <div
        className="absolute -left-6 -bottom-12 h-32 w-32 rounded-full bg-primary-foreground/5 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] md:text-xs uppercase tracking-wider text-primary-foreground/80">
            Patrimônio
          </p>
          <p className="mt-1 text-3xl md:text-5xl font-bold tabular-nums tracking-tight">
            {formatBRL(value)}
          </p>
          <p className="mt-1 text-xs md:text-sm text-primary-foreground/80">
            Soma de contas + investimentos
          </p>
        </div>
        <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-primary-foreground/15 flex items-center justify-center shrink-0">
          <Wallet className="h-6 w-6 md:h-7 md:w-7 text-primary-foreground" />
        </div>
      </div>
    </Card>
  );
}

export default Dashboard;
