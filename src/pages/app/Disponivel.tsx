import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useFinance } from "@/contexts/FinanceContext";
import { CategoryBudgetCard } from "@/components/disponivel/CategoryBudgetCard";
import { CategorySheet } from "@/components/disponivel/CategorySheet";
import { TotalBudgetCard } from "@/components/disponivel/TotalBudgetCard";
import { CycleDaySettingsButton } from "@/components/CycleDaySettingsButton";
import { DEFAULT_PARENT_CATEGORIES } from "@/lib/defaultCategories";

/**
 * Pocket View — "Quanto ainda posso gastar este mês?".
 * Mobile-first: o que importa fica acima da dobra (saldo grande + barra agregada).
 *
 * Regras de visualização:
 * - Sempre mostra as 7 categorias-pai padrão (em ordem alfabética PT-BR), mesmo
 *   sem gasto no ciclo. Convidam o usuário a definir limite logo de cara.
 * - O toggle "Mostrar categorias sem gasto este mês" revela as demais categorias
 *   do catálogo (com ou sem gasto).
 * - Trabalhamos APENAS com categorias-pai aqui; subcategorias servem só para
 *   consulta na página Categorias.
 */
const Disponivel = () => {
  const { budgetProgress, cycleCategoryAggregates, lastCycles, currentCycleLabel, categories } =
    useFinance();

  // Usa o CICLO FINANCEIRO atual configurado pelo usuário.
  const currentCycle = useMemo(() => lastCycles(1)[0], [lastCycles]);
  const cycleKey = currentCycle?.key ?? "";
  const now = new Date();
  const startMs = currentCycle?.start.getTime() ?? now.getTime();
  const endMs = currentCycle?.end.getTime() ?? now.getTime();
  const totalCycleDays = Math.max(
    1,
    Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1,
  );
  const elapsedDays = Math.max(
    1,
    Math.min(
      totalCycleDays,
      Math.round((now.getTime() - startMs) / (1000 * 60 * 60 * 24)) + 1,
    ),
  );

  // Sheet state — única instância, alimentada pela seleção atual.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSelection, setSheetSelection] = useState<{
    categoryLabel: string;
    budgetId: string | null;
  } | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const [onlyWithSpending, setOnlyWithSpending] = useState(false);
  const [onlyWithLimit, setOnlyWithLimit] = useState(false);

  const openSheetForBudget = (b: (typeof budgetProgress)[number]) => {
    setSheetSelection({
      categoryLabel: b.categoryLabel,
      budgetId: b.budgetId,
    });
    setSheetOpen(true);
  };

  const openSheetForLabel = (categoryLabel: string) => {
    setSheetSelection({ categoryLabel, budgetId: null });
    setSheetOpen(true);
  };

  // Agregados do CICLO inteiro (todas as categorias, com ou sem orçamento).
  const cycleAgg = useMemo(() => cycleCategoryAggregates(cycleKey), [cycleCategoryAggregates, cycleKey]);

  // Mapa rápido: label de categoria-pai → orçamento e gasto no ciclo.
  const parentBudgetByLabel = useMemo(() => {
    const m = new Map<string, (typeof budgetProgress)[number]>();
    for (const b of budgetProgress) {
      if (b.scope === "parent") m.set(b.categoryLabel, b);
    }
    return m;
  }, [budgetProgress]);

  const spentByParent = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of cycleAgg.items) m.set(it.parentLabel, it.spent);
    return m;
  }, [cycleAgg]);

  // Catálogo de categorias-pai PT-BR vindas do Pluggy (filtrando transferências/pagto cartão).
  const allCatalogParents = useMemo(() => {
    const set = new Set<string>();
    for (const c of categories) {
      if (c.parentId !== null) continue;
      const label = (c.descriptionTranslated || c.description || "").trim();
      if (!label) continue;
      if (/^Transfer/i.test(label) || /transfer/i.test(label)) continue;
      if (/cart[aã]o de cr[eé]dito|credit card payment/i.test(label)) continue;
      set.add(label);
    }
    // Garante que as 7 padrão sempre estejam disponíveis, mesmo se o catálogo ainda
    // não foi sincronizado.
    for (const def of DEFAULT_PARENT_CATEGORIES) set.add(def);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categories]);

  // Helper: monta a "linha" da categoria — preferindo o BudgetProgress quando há
  // orçamento (assim o card mostra barra/restante), caindo para "unbudgeted" caso contrário.
  const renderCategoryRow = (label: string) => {
    const budget = parentBudgetByLabel.get(label);
    if (budget) {
      return (
        <CategoryBudgetCard
          key={label}
          progress={budget}
          onOpenSheet={() => openSheetForBudget(budget)}
        />
      );
    }
    const spent = spentByParent.get(label) ?? 0;
    return (
      <CategoryBudgetCard
        key={label}
        unbudgeted={{ categoryLabel: label, spent }}
        onOpenSheet={() => openSheetForLabel(label)}
        onCreateBudget={(l) => openSheetForLabel(l)}
      />
    );
  };

  // Linhas SEMPRE visíveis: as 7 padrão em ordem alfabética.
  const defaultLabels = useMemo(
    () => [...DEFAULT_PARENT_CATEGORIES].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [],
  );

  // Categorias EXTRAS do catálogo (excluindo as padrão). Aparecem só com toggle.
  const extraLabels = useMemo(
    () => allCatalogParents.filter((l) => !defaultLabels.includes(l as never)),
    [allCatalogParents, defaultLabels],
  );

  // Quando "apenas com gastos" está ativo, ignoramos a separação default/extra
  // e listamos TODAS as categorias-pai do catálogo que tiveram gasto neste ciclo
  // (incluindo as que apareceriam só sob o toggle "outras categorias").
  const labelsWithSpending = useMemo(() => {
    const set = new Set<string>();
    for (const l of allCatalogParents) {
      if ((spentByParent.get(l) ?? 0) > 0) set.add(l);
    }
    // Garante categorias com gasto que por algum motivo não estejam no catálogo.
    for (const [l, v] of spentByParent) {
      if (v > 0) set.add(l);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allCatalogParents, spentByParent]);

  // Helper: aplica o filtro "apenas com limite definido" sobre uma lista de labels.
  const applyLimitFilter = (labels: string[]) =>
    onlyWithLimit ? labels.filter((l) => parentBudgetByLabel.has(l)) : labels;

  return (
    <div
      className="px-4 pt-4 pb-8 md:p-8 max-w-2xl mx-auto space-y-5"
      style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
    >
      {/* Header minúsculo */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground truncate">
            Ciclo {currentCycleLabel}
          </p>
          <CycleDaySettingsButton className="h-7 w-7 shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums shrink-0">
          dia {elapsedDays} de {totalCycleDays}
        </p>
      </div>

      {/* Limite total — sempre visível (define ou edita). */}
      <TotalBudgetCard spent={cycleAgg.total} />

      {/* Sessão de categorias: cabeçalho + toggles ACIMA da lista. */}
      <section className="space-y-3">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground px-1">
          Categorias
        </h3>

        {/* Toggles de visualização — sempre acima da lista. */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <Label
              htmlFor="only-with-limit"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              Apenas com limite definido
            </Label>
            <Switch
              id="only-with-limit"
              checked={onlyWithLimit}
              onCheckedChange={setOnlyWithLimit}
            />
          </div>
          <div className="flex items-center justify-between gap-3 px-1">
            <Label
              htmlFor="only-with-spending"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              Apenas com gastos no ciclo
            </Label>
            <Switch
              id="only-with-spending"
              checked={onlyWithSpending}
              onCheckedChange={setOnlyWithSpending}
            />
          </div>
          {!onlyWithSpending && extraLabels.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-1">
              <Label
                htmlFor="show-other-cats"
                className="text-xs text-muted-foreground cursor-pointer select-none"
              >
                Mostrar outras categorias
              </Label>
              <Switch
                id="show-other-cats"
                checked={showOthers}
                onCheckedChange={setShowOthers}
              />
            </div>
          )}
        </div>

        {/* Lista de categorias. */}
        <div className="space-y-2">
          {onlyWithSpending ? (
            applyLimitFilter(labelsWithSpending).length > 0 ? (
              applyLimitFilter(labelsWithSpending).map((label) => renderCategoryRow(label))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">
                {onlyWithLimit
                  ? "Nenhuma categoria com gasto e limite definido neste ciclo."
                  : "Nenhuma categoria com gasto neste ciclo."}
              </p>
            )
          ) : (
            <>
              {applyLimitFilter(defaultLabels).map((label) => renderCategoryRow(label))}
              {showOthers &&
                applyLimitFilter(extraLabels).map((label) => renderCategoryRow(label))}
              {onlyWithLimit &&
                applyLimitFilter(defaultLabels).length === 0 &&
                (!showOthers || applyLimitFilter(extraLabels).length === 0) && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhuma categoria com limite definido.
                  </p>
                )}
            </>
          )}
        </div>
      </section>

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
        />
      )}
    </div>
  );
};

export default Disponivel;
