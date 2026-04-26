import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Versão compacta da Pocket View para o topo do Dashboard.
 *
 * Prioridade do teto exibido:
 *   1. Limite TOTAL definido pelo usuário (`totalBudget.monthlyLimit`).
 *   2. Soma dos limites por categoria (fallback).
 * Quando o teto vem do limite total, o "gasto" é o TOTAL do ciclo financeiro
 * — assim o card reflete tudo que o usuário consumiu, não apenas as categorias
 * com orçamento.
 */
export function PocketSummaryCard() {
  const { budgetProgress, totalBudget, cycleCategoryAggregates, lastCycles } = useFinance();

  const currentCycle = useMemo(() => lastCycles(1)[0], [lastCycles]);
  const cycleKey = currentCycle?.key ?? "";
  const cycleAgg = useMemo(
    () => cycleCategoryAggregates(cycleKey),
    [cycleCategoryAggregates, cycleKey],
  );

  const totals = useMemo(() => {
    const parentSum = budgetProgress
      .filter((b) => b.scope === "parent")
      .reduce((s, b) => s + b.limit, 0);
    const limit = totalBudget?.monthlyLimit ?? parentSum;
    const spent = totalBudget
      ? cycleAgg.total
      : budgetProgress
          .filter((b) => b.scope === "parent")
          .reduce((s, b) => s + b.spent, 0);
    return {
      limit,
      spent,
      available: limit - spent,
      ratio: limit > 0 ? Math.min(1, spent / limit) : 0,
      hasLimit: limit > 0,
    };
  }, [budgetProgress, totalBudget, cycleAgg]);

  const top = useMemo(() => {
    const order: Record<string, number> = { over: 0, alert: 1, ok: 2 };
    return [...budgetProgress]
      .sort((a, b) => {
        const diff = order[a.status] - order[b.status];
        if (diff !== 0) return diff;
        return b.ratio - a.ratio;
      })
      .slice(0, 3);
  }, [budgetProgress]);

  if (!totals.hasLimit) {
    return (
      <Card className="bg-gradient-card border-border p-4 md:p-5 flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Quanto posso gastar?</p>
          <p className="text-xs text-muted-foreground">
            Defina um limite mensal pra ver aqui o saldo disponível.
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/app/disponivel">Começar</Link>
        </Button>
      </Card>
    );
  }

  const availablePositive = totals.available >= 0;

  return (
    <Card className="bg-gradient-card border-border p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Disponível este mês
          </p>
          <p
            className={cn(
              "text-2xl md:text-3xl font-bold tracking-tight tabular-nums mt-0.5",
              availablePositive ? "text-foreground" : "text-destructive",
            )}
          >
            {formatBRL(totals.available)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
            {formatBRL(totals.spent)} de {formatBRL(totals.limit)}
            {totalBudget ? " · limite total" : " · soma das categorias"}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0 text-xs">
          <Link to="/app/disponivel">
            Ver tudo <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </div>

      <Progress
        value={totals.ratio * 100}
        className={cn(
          "h-1.5 mt-3",
          totals.ratio >= 1
            ? "[&>div]:bg-destructive"
            : totals.ratio >= 0.8
              ? "[&>div]:bg-warning"
              : "[&>div]:bg-success",
        )}
      />

      {top.length > 0 && (
        <ul className="mt-4 space-y-2">
          {top.map((b) => {
            const pct = Math.min(100, Math.round(b.ratio * 100));
            const dotClass =
              b.status === "over"
                ? "bg-destructive"
                : b.status === "alert"
                  ? "bg-warning"
                  : "bg-success";
            return (
              <li key={b.budgetId} className="flex items-center gap-2.5 text-xs">
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotClass)} />
                <span className="flex-1 truncate text-foreground">{b.categoryLabel}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">{pct}%</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
