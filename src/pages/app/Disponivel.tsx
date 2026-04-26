import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Wallet, ArrowRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useFinance } from "@/contexts/FinanceContext";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryBudgetCard } from "@/components/disponivel/CategoryBudgetCard";
import { CategorySheet } from "@/components/disponivel/CategorySheet";

/**
 * Pocket View — "Quanto ainda posso gastar este mês?".
 * Mobile-first: o que importa fica acima da dobra (saldo grande + barra agregada).
 * Sem poluição: só lista categorias com orçamento OU com gasto real no mês.
 */
const Disponivel = () => {
  const { budgetProgress, monthlyCategoryAggregates, currentMonthLabel, categories } = useFinance();

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dayOfMonth = now.getDate();
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Sheet state — única instância, alimentada pela seleção atual.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSelection, setSheetSelection] = useState<{
    categoryLabel: string;
    parentCategoryLabel: string | null;
    budgetId: string | null;
  } | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const openSheetForBudget = (b: (typeof budgetProgress)[number]) => {
    setSheetSelection({
      categoryLabel: b.categoryLabel,
      parentCategoryLabel: b.parentCategoryLabel,
      budgetId: b.budgetId,
    });
    setSheetOpen(true);
  };

  const openSheetForNew = (categoryLabel: string) => {
    setSheetSelection({ categoryLabel, parentCategoryLabel: null, budgetId: null });
    setSheetOpen(true);
  };

  // Totais agregados.
  const totals = useMemo(() => {
    const limit = budgetProgress.reduce((s, b) => s + b.limit, 0);
    const spent = budgetProgress.reduce((s, b) => s + b.spent, 0);
    const available = limit - spent;
    const ratio = limit > 0 ? Math.min(1, spent / limit) : 0;
    return { limit, spent, available, ratio };
  }, [budgetProgress]);

  // Ordena: estouro primeiro, depois alerta, depois ok (por ratio decrescente).
  const sortedBudgets = useMemo(() => {
    const order: Record<string, number> = { over: 0, alert: 1, ok: 2 };
    return [...budgetProgress].sort((a, b) => {
      const diff = order[a.status] - order[b.status];
      if (diff !== 0) return diff;
      return b.ratio - a.ratio;
    });
  }, [budgetProgress]);

  // Categorias com gasto no mês mas sem orçamento — sugestões.
  const unbudgeted = useMemo(() => {
    const monthly = monthlyCategoryAggregates(monthKey);
    const labelsWithBudget = new Set(
      budgetProgress.filter((b) => b.scope === "parent").map((b) => b.categoryLabel),
    );
    return monthly.items
      .filter((it) => !labelsWithBudget.has(it.parentLabel))
      .map((it) => ({ categoryLabel: it.parentLabel, spent: it.spent }))
      .slice(0, 6);
  }, [budgetProgress, monthlyCategoryAggregates, monthKey]);

  // Catálogo de categorias-pai (PT-BR) que ainda não têm orçamento e nem gasto no mês.
  // Permite ao usuário definir limite mesmo sem ter consumido na categoria.
  const catalogParents = useMemo(() => {
    const labelsWithBudget = new Set(
      budgetProgress.filter((b) => b.scope === "parent").map((b) => b.categoryLabel),
    );
    const labelsWithSpend = new Set(unbudgeted.map((u) => u.categoryLabel));

    // Coleta nomes únicos de categorias pai do catálogo Pluggy.
    const parentSet = new Set<string>();
    for (const c of categories) {
      // Categoria pai: parentId === null. Usa parentDescription quando vier preenchida,
      // senão a própria description traduzida.
      const isParent = c.parentId === null;
      if (!isParent) continue;
      const label = (c.descriptionTranslated || c.description || "").trim();
      if (!label) continue;
      // Filtra transferências/pagamento de cartão (não são despesa real).
      if (/^Transfer/i.test(label) || /transfer/i.test(label)) continue;
      if (/cart[aã]o de cr[eé]dito|credit card payment/i.test(label)) continue;
      parentSet.add(label);
    }

    return Array.from(parentSet)
      .filter((label) => !labelsWithBudget.has(label) && !labelsWithSpend.has(label))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categories, budgetProgress, unbudgeted]);

  const isEmpty = budgetProgress.length === 0;
  const availablePositive = totals.available >= 0;

  return (
    <div
      className="px-4 pt-4 pb-8 md:p-8 max-w-2xl mx-auto space-y-5"
      style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
    >
      {/* Header minúsculo */}
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {currentMonthLabel}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          dia {dayOfMonth} de {totalDays}
        </p>
      </div>

      {/* Hero: número grande */}
      {isEmpty ? (
        <Card className="bg-gradient-card border-border p-6 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              Defina seu primeiro limite
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Em poucos toques você passa a ver, antes de qualquer compra, quanto ainda pode gastar este mês.
            </p>
          </div>
          {unbudgeted.length > 0 && (
            <div className="space-y-2 text-left pt-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Sugestões</p>
              {unbudgeted.slice(0, 3).map((u) => (
                <CategoryBudgetCard
                  key={u.categoryLabel}
                  unbudgeted={u}
                  onOpenSheet={() => openSheetForNew(u.categoryLabel)}
                  onCreateBudget={(label) => openSheetForNew(label)}
                />
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card className="bg-gradient-card border-border p-5 md:p-6">
          <p className="text-xs text-muted-foreground">Disponível este mês</p>
          <p
            className={cn(
              "text-4xl md:text-5xl font-bold tracking-tight tabular-nums mt-1",
              availablePositive ? "text-foreground" : "text-destructive",
            )}
          >
            {formatBRL(totals.available)}
          </p>
          <div className="mt-4 space-y-2">
            <Progress
              value={totals.ratio * 100}
              className={cn(
                "h-2",
                totals.ratio >= 1
                  ? "[&>div]:bg-destructive"
                  : totals.ratio >= 0.8
                    ? "[&>div]:bg-warning"
                    : "[&>div]:bg-success",
              )}
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>{formatBRL(totals.spent)} gastos</span>
              <span>{formatBRL(totals.limit)} orçados</span>
            </div>
          </div>
        </Card>
      )}

      {/* Lista de categorias com orçamento */}
      {sortedBudgets.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground px-1">
            Por categoria
          </h3>
          <div className="space-y-2">
            {sortedBudgets.map((b) => (
              <CategoryBudgetCard
                key={b.budgetId}
                progress={b}
                onOpenSheet={() => openSheetForBudget(b)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Categorias sem orçamento mas com gasto real */}
      {!isEmpty && unbudgeted.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground px-1">
            Sem limite ainda
          </h3>
          <div className="space-y-2">
            {unbudgeted.map((u) => (
              <CategoryBudgetCard
                key={u.categoryLabel}
                unbudgeted={u}
                onOpenSheet={() => openSheetForNew(u.categoryLabel)}
                onCreateBudget={(label) => openSheetForNew(label)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Toggle minimalista: ver todas as categorias-pai do catálogo (sem gasto ainda). */}
      {catalogParents.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <Label
              htmlFor="show-all-cats"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              Mostrar categorias sem gasto este mês
            </Label>
            <Switch
              id="show-all-cats"
              checked={showAllCategories}
              onCheckedChange={setShowAllCategories}
            />
          </div>
          {showAllCategories && (
            <div className="space-y-2">
              {catalogParents.map((label) => (
                <CategoryBudgetCard
                  key={label}
                  unbudgeted={{ categoryLabel: label, spent: 0 }}
                  onOpenSheet={() => openSheetForNew(label)}
                  onCreateBudget={(l) => openSheetForNew(l)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Atalhos discretos */}
      <div className="flex items-center justify-center pt-2">
        <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground">
          <Link to="/app/categorizacao">
            Gerenciar todas as categorias <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </div>

      {sheetSelection && (
        <CategorySheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          budgetId={sheetSelection.budgetId}
          categoryLabel={sheetSelection.categoryLabel}
          parentCategoryLabel={sheetSelection.parentCategoryLabel}
        />
      )}
    </div>
  );
};

export default Disponivel;
