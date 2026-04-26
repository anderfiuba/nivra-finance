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

  if (!totals.hasLimit) {
    return (
      <Card className="bg-gradient-card border-border p-4 md:p-5 flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Quanto posso gastar?</p>
          <p className="text-xs text-muted-foreground">
            Defina um limite do seu ciclo financeiro pra ver aqui o saldo disponível.
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
            Disponível no seu ciclo financeiro
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
    </Card>
  );
}
