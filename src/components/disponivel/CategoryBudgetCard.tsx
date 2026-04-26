import { AlertTriangle, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BudgetProgress } from "@/contexts/FinanceContext";

interface Props {
  /** Quando há orçamento. */
  progress?: BudgetProgress;
  /** Quando não há orçamento, exibe gasto + CTA. */
  unbudgeted?: { categoryLabel: string; spent: number };
  onOpenSheet: () => void;
  onCreateBudget?: (label: string) => void;
}

/**
 * Card de uma categoria na Pocket View.
 * Mobile-first: alvo de toque grande (min-h 88px), tipografia clara, barra colorida
 * por status. Em desktop ganha leve hover. Sempre clicável (abre o sheet).
 */
export function CategoryBudgetCard({ progress, unbudgeted, onOpenSheet, onCreateBudget }: Props) {
  if (unbudgeted) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-3.5 min-h-[72px] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{unbudgeted.categoryLabel}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sem limite • gastou {formatBRL(unbudgeted.spent)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 h-8 text-xs"
          onClick={() => onCreateBudget?.(unbudgeted.categoryLabel)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Limite
        </Button>
      </div>
    );
  }

  if (!progress) return null;

  const remaining = Math.max(0, progress.limit - progress.spent);
  const overBy = Math.max(0, progress.spent - progress.limit);
  const pct = Math.min(100, Math.round(progress.ratio * 100));

  const tone =
    progress.status === "over"
      ? "destructive"
      : progress.status === "alert"
        ? "warning"
        : "success";

  const barClass = cn(
    "h-2 [&>div]:transition-all",
    tone === "destructive" && "[&>div]:bg-destructive",
    tone === "warning" && "[&>div]:bg-warning",
    tone === "success" && "[&>div]:bg-success",
  );

  const remainingLabel =
    progress.status === "over"
      ? `Estourou em ${formatBRL(overBy)}`
      : `Resta ${formatBRL(remaining)}`;

  const remainingClass =
    progress.status === "over"
      ? "text-destructive"
      : progress.status === "alert"
        ? "text-warning"
        : "text-success";

  return (
    <button
      type="button"
      onClick={onOpenSheet}
      className="w-full text-left rounded-xl border border-border/60 bg-card/40 p-3.5 min-h-[88px] hover:bg-card/70 transition-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground truncate">
              {progress.categoryLabel}
            </p>
            {progress.scope === "child" && progress.parentCategoryLabel && (
              <span className="text-[10px] text-muted-foreground truncate">
                · {progress.parentCategoryLabel}
              </span>
            )}
            {progress.status !== "ok" && (
              <AlertTriangle
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  progress.status === "over" ? "text-destructive" : "text-warning",
                )}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
            {formatBRL(progress.spent)} de {formatBRL(progress.limit)}
          </p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
      </div>
      <Progress value={pct} className={barClass} />
      <p className={cn("text-[11px] mt-2 font-medium tabular-nums", remainingClass)}>
        {remainingLabel}
      </p>
    </button>
  );
}
