import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ChevronRight,
  PencilLine,
  Plus,
  Trash2,
  PieChart as PieIcon,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useFinance } from "@/contexts/FinanceContext";
import { formatBRL } from "@/lib/format";
import { MonthSelector } from "@/components/extrato/MonthSelector";
import { CycleDaySettingsButton } from "@/components/CycleDaySettingsButton";
import { DEFAULT_PARENT_CATEGORIES } from "@/lib/defaultCategories";
import { TotalBudgetCard } from "@/components/disponivel/TotalBudgetCard";
import { CycleStatsWidgets } from "@/components/disponivel/CycleStatsWidgets";
import { CategoryIcon } from "@/lib/categoryIcons";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Página Categorias.
 *
 * Regras:
 * - Trabalhamos APENAS com categorias-pai. Subcategorias servem só para
 *   consultar detalhes (expandir e ver gastos por subcategoria).
 * - As 7 categorias padrão (Alimentos e bebidas, Lazer, Moradia, Saúde,
 *   Serviços, Transporte, Viagens) ficam sempre visíveis em ordem alfabética,
 *   mesmo sem gasto.
 * - Demais categorias do catálogo aparecem via toggle.
 * - O limite total do mês (definido em "Quanto posso gastar?") atua como teto
 *   da soma dos limites por categoria.
 */
const Categorizacao = () => {
  const {
    categories,
    categoryBudgets,
    cycleCategoryAggregates,
    lastCycles,
    upsertBudget,
    deleteBudget,
    totalBudget,
    parentBudgetsSum,
    currentCycleLabel,
  } = useFinance();
  const isMobile = useIsMobile();

  // ---------- estado ----------
  const cycles = useMemo(() => lastCycles(12), [lastCycles]);
  const [monthKey, setMonthKey] = useState<string>(cycles[0]?.key ?? "");
  useEffect(() => {
    if (cycles[0] && !cycles.some((c) => c.key === monthKey)) {
      setMonthKey(cycles[0].key);
    }
  }, [cycles, monthKey]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Filtro único da lista de categorias (substitui os 3 toggles antigos):
  // - "default":        7 categorias-pai padrão
  // - "withSpending":   apenas categorias com gasto no ciclo
  // - "withLimit":      apenas categorias com limite definido
  // - "all":            mostra tudo (padrão + extras do catálogo)
  type FilterMode = "default" | "withSpending" | "withLimit" | "all";
  const [filterMode, setFilterMode] = useState<FilterMode>("default");
  const onlyWithSpending = filterMode === "withSpending";
  const onlyWithLimit = filterMode === "withLimit";
  const showOthers = filterMode === "all";

  // dialog (somente categoria-pai)
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgParentLabel, setDlgParentLabel] = useState<string>("");
  const [dlgLimit, setDlgLimit] = useState<string>("");
  const [dlgThreshold, setDlgThreshold] = useState<number>(80);
  const [dlgEditingId, setDlgEditingId] = useState<string | null>(null);
  const [dlgError, setDlgError] = useState<string | null>(null);

  // ---------- derivados ----------
  const monthly = useMemo(() => cycleCategoryAggregates(monthKey), [cycleCategoryAggregates, monthKey]);
  const monthBucket = useMemo(
    () => cycles.find((c) => c.key === monthKey) ?? cycles[0],
    [cycles, monthKey],
  );

  // Catálogo: todos os labels de categorias-pai PT-BR, em ordem alfabética.
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
    for (const def of DEFAULT_PARENT_CATEGORIES) set.add(def);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categories]);

  const budgetByParent = useMemo(() => {
    const m = new Map<string, typeof categoryBudgets[number]>();
    for (const b of categoryBudgets) if (b.scope === "parent") m.set(b.categoryLabel, b);
    return m;
  }, [categoryBudgets]);

  const aggByParent = useMemo(() => {
    const m = new Map<string, typeof monthly.items[number]>();
    for (const it of monthly.items) m.set(it.parentLabel, it);
    return m;
  }, [monthly.items]);

  // Linhas SEMPRE visíveis: 7 padrão + qualquer outra que tenha gasto neste ciclo
  // OU que tenha orçamento definido. Tudo em ordem alfabética.
  const primaryLabels = useMemo(() => {
    const set = new Set<string>(DEFAULT_PARENT_CATEGORIES);
    for (const it of monthly.items) set.add(it.parentLabel);
    for (const b of categoryBudgets) if (b.scope === "parent") set.add(b.categoryLabel);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [monthly.items, categoryBudgets]);

  // Categorias EXTRAS do catálogo (visíveis só com toggle).
  const extraLabels = useMemo(
    () => allCatalogParents.filter((l) => !primaryLabels.includes(l)),
    [allCatalogParents, primaryLabels],
  );

  // Quando "apenas com gastos" está ativo, listamos TODAS as categorias-pai
  // (catálogo completo + qualquer agregação do ciclo) que tiveram gasto > 0,
  // ignorando a separação default/extra.
  const labelsWithSpending = useMemo(() => {
    const set = new Set<string>();
    for (const it of monthly.items) {
      if (it.spent > 0) set.add(it.parentLabel);
    }
    for (const l of allCatalogParents) {
      const sp = aggByParent.get(l)?.spent ?? 0;
      if (sp > 0) set.add(l);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [monthly.items, allCatalogParents, aggByParent]);

  // Helper aplicado a qualquer lista: limita às que tem orçamento se o toggle estiver ligado.
  const applyLimitFilter = (labels: string[]) =>
    onlyWithLimit ? labels.filter((l) => budgetByParent.has(l)) : labels;

  // Dados pro gráfico circular: TODAS as categorias-pai com gasto > 0 no ciclo,
  // ordenadas por valor desc. Cores via HSL gerada a partir de hash do label.
  const donutData = useMemo(() => {
    const items = monthly.items
      .filter((it) => it.spent > 0)
      .sort((a, b) => b.spent - a.spent);
    return items.map((it, idx) => ({
      name: it.parentLabel,
      value: it.spent,
      color: pickHue(idx, items.length),
    }));
  }, [monthly.items]);

  const donutInner = isMobile ? 50 : 70;
  const donutOuter = isMobile ? 80 : 105;

  // ---------- dialog handlers ----------
  const openNewBudget = (parentLabel: string) => {
    setDlgParentLabel(parentLabel);
    setDlgLimit("");
    setDlgThreshold(80);
    setDlgEditingId(null);
    setDlgError(null);
    setDlgOpen(true);
  };

  const openEditBudget = (budgetId: string) => {
    const b = categoryBudgets.find((x) => x.id === budgetId);
    if (!b) return;
    setDlgParentLabel(b.categoryLabel);
    setDlgLimit(String(b.monthlyLimit));
    setDlgThreshold(Math.round(b.alertThreshold * 100));
    setDlgEditingId(b.id);
    setDlgError(null);
    setDlgOpen(true);
  };

  // ---------- validação ----------
  const validateBudget = (parentLabel: string, limit: number): string | null => {
    if (!parentLabel) return "Escolha a categoria.";
    if (totalBudget) {
      const previousLimit = dlgEditingId
        ? categoryBudgets.find((b) => b.id === dlgEditingId && b.scope === "parent")?.monthlyLimit ?? 0
        : 0;
      const projectedSum = parentBudgetsSum - previousLimit + limit;
      if (projectedSum > totalBudget.monthlyLimit + 0.001) {
        return `A soma dos limites por categoria (${formatBRL(projectedSum)}) ficaria acima do limite total do mês (${formatBRL(totalBudget.monthlyLimit)}). Aumente o limite total ou reduza este valor.`;
      }
    }
    return null;
  };

  const saveBudget = async () => {
    const limit = Number(dlgLimit.replace(",", "."));
    if (!Number.isFinite(limit) || limit <= 0) {
      setDlgError("Informe um limite válido.");
      return;
    }
    const err = validateBudget(dlgParentLabel, limit);
    if (err) {
      setDlgError(err);
      return;
    }
    await upsertBudget(dlgParentLabel, limit, dlgThreshold / 100, "parent", null);
    setDlgOpen(false);
    toast.success("Orçamento salvo.");
  };

  const removeBudget = async (id: string) => {
    await deleteBudget(id);
    toast.success("Orçamento removido.");
  };

  useEffect(() => {
    setExpanded({});
  }, [monthKey]);

  // ---------- renderização de uma linha de categoria-pai ----------
  const renderRow = (label: string) => {
    const item = aggByParent.get(label);
    const spent = item?.spent ?? 0;
    const children = item?.children ?? [];
    const parentBudget = budgetByParent.get(label);
    const ratio = parentBudget && parentBudget.monthlyLimit > 0 ? spent / parentBudget.monthlyLimit : 0;
    const status: "ok" | "alert" | "over" = !parentBudget
      ? "ok"
      : ratio >= 1
        ? "over"
        : ratio >= parentBudget.alertThreshold
          ? "alert"
          : "ok";
    const visualPct = parentBudget
      ? Math.min(100, ratio * 100)
      : Math.round((item?.pctOfTotal ?? 0) * 100);
    const barTone = !parentBudget
      ? "[&>div]:bg-primary/40"
      : status === "over"
        ? "[&>div]:bg-destructive"
        : status === "alert"
          ? "[&>div]:bg-warning"
          : "[&>div]:bg-primary";
    const isOpen = !!expanded[label];
    const hasChildren = children.length > 0;

    return (
      <Collapsible
        key={label}
        className="border border-none border-secondary"
        open={isOpen}
        onOpenChange={(o) => setExpanded((p) => ({ ...p, [label]: o }))}
      >
        <div className="p-3.5 md:p-5 space-y-3 rounded-lg bg-card/40 md:rounded-none md:border-0 md:bg-transparent py-[25px] mx-[5px] px-[25px] border-primary border">
          <div className="flex items-start gap-2 md:gap-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-start gap-2 md:gap-3 flex-1 min-w-0 text-left group"
                aria-label={`Expandir ${label}`}
                disabled={!hasChildren}
              >
                <ChevronRight
                  className={cn(
                    "h-4 w-4 mt-1 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-90",
                    !hasChildren && "opacity-0",
                  )}
                />
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0">
                  <CategoryIcon
                    label={label}
                    size={20}
                    className="text-muted-foreground"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate group-hover:underline">
                      {label}
                    </p>
                    {parentBudget && (
                      <Badge variant="outline" className="text-[10px] h-5 border-border bg-secondary/40">
                        Limite {formatBRL(parentBudget.monthlyLimit)}
                      </Badge>
                    )}
                    {status === "over" && (
                      <Badge variant="outline" className="text-[10px] h-5 border-destructive/30 bg-destructive/10 text-destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Estourou
                      </Badge>
                    )}
                    {status === "alert" && (
                      <Badge variant="outline" className="text-[10px] h-5 border-warning/30 bg-warning/10 text-warning">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Próximo do limite
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                    {parentBudget
                      ? `${formatBRL(spent)} de ${formatBRL(parentBudget.monthlyLimit)} · ${(ratio * 100).toFixed(0)}%`
                      : spent > 0
                        ? `${((item?.pctOfTotal ?? 0) * 100).toFixed(0)}% do total do mês`
                        : "Sem gastos neste mês"}
                  </p>
                </div>
              </button>
            </CollapsibleTrigger>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold tabular-nums text-foreground whitespace-nowrap">
                {formatBRL(spent)}
              </p>
              <div className="mt-1 hidden md:flex items-center gap-1 justify-end">
                {parentBudget ? (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEditBudget(parentBudget.id)}>
                      <PencilLine className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeBudget(parentBudget.id)}
                      aria-label="Remover orçamento"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => openNewBudget(label)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Limite
                  </Button>
                )}
              </div>
            </div>
          </div>
          <Progress value={visualPct} className={`h-1.5 ${barTone}`} />
          {/* Ações em telas pequenas */}
          <div className="flex md:hidden items-center gap-1 justify-end">
            {parentBudget ? (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEditBudget(parentBudget.id)}>
                  <PencilLine className="h-3 w-3 mr-1" /> Editar limite
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeBudget(parentBudget.id)}
                  aria-label="Remover orçamento"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => openNewBudget(label)}
              >
                <Plus className="h-3 w-3 mr-1" /> Definir limite
              </Button>
            )}
          </div>

          {/* Subcategorias — APENAS PARA CONSULTA (sem ação de orçamento) */}
          {hasChildren && (
            <CollapsibleContent>
              <div className="mt-3 ml-2 md:ml-7 space-y-3 md:space-y-2 border-l border-border pl-3 md:pl-4">
                {children.map((c) => {
                  const cVisual = Math.round(c.pctOfParent * 100);
                  return (
                    <div key={c.label} className="py-1.5">
                      <div className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                          <CategoryIcon
                            label={c.label}
                            size={18}
                            className="text-muted-foreground/80"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{c.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                            {(c.pctOfParent * 100).toFixed(0)}% de {label}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold tabular-nums text-foreground">{formatBRL(c.spent)}</p>
                        </div>
                      </div>
                      <Progress value={cVisual} className="h-1 mt-1.5 [&>div]:bg-muted-foreground/30" />
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          )}
        </div>
      </Collapsible>
    );
  };

  // ============== render ==============
  return (
    <div
      className="p-4 pb-10 md:p-8 space-y-5 md:space-y-6 max-w-[1400px] mx-auto"
      style={{ paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}
    >
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
          Ciclo Financeiro
        </h1>
        <p className="mt-1 text-xs md:text-sm text-muted-foreground">
          Centro de gestão de limites e categorias do seu ciclo financeiro.
        </p>
      </div>

      {/* Header do ciclo: seletor + ciclo atual */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <MonthSelector months={cycles} value={monthKey} onChange={setMonthKey} />
          <CycleDaySettingsButton className="h-9 w-9 shrink-0" />
        </div>
        <p className="text-[11px] md:text-xs uppercase tracking-wider text-muted-foreground truncate">
          Ciclo {currentCycleLabel}
        </p>
      </div>

      {/* 1º Gadget: Limite total do ciclo financeiro */}
      <TotalBudgetCard spent={monthly.total} />

      {/* 2º Gadget: 4 widgets (Limite/Gasto/Disponível/Dias restantes) */}
      <CycleStatsWidgets
        limit={totalBudget?.monthlyLimit ?? null}
        spent={monthly.total}
        daysRemaining={(() => {
          if (!monthBucket) return 0;
          const now = new Date();
          const ms = monthBucket.end.getTime() - now.getTime();
          return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
        })()}
        cycleEndLabel={
          monthBucket
            ? monthBucket.end
                .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                .replace(".", "")
            : "—"
        }
      />

      {/* Visão geral: gráfico circular + total gasto */}
      <Card className="bg-card shadow-none border-border p-4 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <PieIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs md:text-sm font-semibold text-foreground uppercase tracking-wider">
            Gastos por categoria no ciclo
          </h3>
        </div>
        {donutData.length === 0 ? (
          <div className="h-[200px] md:h-[260px] flex items-center justify-center text-xs text-muted-foreground text-center px-4">
            Sem gastos registrados neste ciclo.
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
            <div className="relative w-full md:w-1/2 max-w-[280px]">
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={donutInner}
                    outerRadius={donutOuter}
                    paddingAngle={2}
                  >
                    {donutData.map((entry) => (
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
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Total
                </p>
                <p className="text-base md:text-xl font-bold tabular-nums text-foreground">
                  {formatBRL(monthly.total)}
                </p>
              </div>
            </div>
            <div className="w-full md:flex-1 space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
              {donutData.map((c) => {
                const pct = monthly.total > 0 ? (c.value / monthly.total) * 100 : 0;
                return (
                  <div
                    key={c.name}
                    className="flex items-center justify-between text-xs gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: c.color }}
                      />
                      <CategoryIcon
                        label={c.name}
                        size={14}
                        className="text-muted-foreground shrink-0"
                      />
                      <span className="text-foreground truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-foreground font-medium tabular-nums">
                        {formatBRL(c.value)}
                      </span>
                      <span className="text-muted-foreground text-[11px] tabular-nums w-9 text-right">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* 4º Gadget: Orçamentos do mês */}
      <Card className="bg-card shadow-none border-border p-4 md:p-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <PieIcon className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-xs md:text-sm font-semibold text-foreground uppercase tracking-wider truncate">
              Orçamentos do mês
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            {Array.from(budgetByParent.values()).length}{" "}
            {Array.from(budgetByParent.values()).length === 1 ? "ativo" : "ativos"}
          </span>
        </div>
        {Array.from(budgetByParent.values()).length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum limite por categoria definido. Use a lista abaixo para definir.
          </p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            {Array.from(budgetByParent.values())
              .sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel, "pt-BR"))
              .map((b) => {
                const spent = aggByParent.get(b.categoryLabel)?.spent ?? 0;
                const ratio = b.monthlyLimit > 0 ? spent / b.monthlyLimit : 0;
                const pct = Math.round(Math.min(1, ratio) * 100);
                const tone =
                  ratio >= 1
                    ? "[&>div]:bg-destructive"
                    : ratio >= b.alertThreshold
                      ? "[&>div]:bg-warning"
                      : "[&>div]:bg-primary";
                return (
                  <li key={b.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-foreground truncate">{b.categoryLabel}</span>
                      <span
                        className={cn(
                          "tabular-nums font-medium shrink-0",
                          ratio >= 1 ? "text-destructive" : "text-success",
                        )}
                      >
                        {pct}%
                      </span>
                    </div>
                    <Progress value={pct} className={cn("h-1", tone)} />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                      <span>{formatBRL(spent)}</span>
                      <span>de {formatBRL(b.monthlyLimit)}</span>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </Card>

      {/* Sessão: limites por categoria */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
            Limites por categoria
          </h3>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {monthly.items.length}{" "}
            {monthly.items.length === 1 ? "com gasto" : "com gasto"}
          </span>
        </div>

        {/* Filtro único da lista (substitui os 3 toggles antigos) */}
        <div className="flex items-center gap-2 px-1">
          <Label
            htmlFor="cat-filter"
            className="text-xs text-muted-foreground select-none shrink-0"
          >
            Filtrar
          </Label>
          <Select
            value={filterMode}
            onValueChange={(v) => setFilterMode(v as FilterMode)}
          >
            <SelectTrigger
              id="cat-filter"
              className="h-9 flex-1 bg-input border-border text-xs md:text-sm"
            >
              <SelectValue placeholder="Selecione um filtro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Categorias padrão</SelectItem>
              <SelectItem value="withLimit">Apenas com limite definido</SelectItem>
              <SelectItem value="withSpending">Apenas com gastos no ciclo</SelectItem>
              <SelectItem value="all">Todas as categorias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de categorias. */}
        <Card className="bg-card shadow-none border-border overflow-hidden">
          <div className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-border p-2 md:p-0">
            {onlyWithSpending ? (
              applyLimitFilter(labelsWithSpending).length > 0 ? (
                applyLimitFilter(labelsWithSpending).map((label) => renderRow(label))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {onlyWithLimit
                    ? "Nenhuma categoria com gasto e limite definido neste ciclo."
                    : "Nenhuma categoria com gasto neste ciclo."}
                </p>
              )
            ) : (
              <>
                {applyLimitFilter(primaryLabels).map((label) => renderRow(label))}
                {showOthers &&
                  applyLimitFilter(extraLabels).map((label) => renderRow(label))}
                {onlyWithLimit &&
                  applyLimitFilter(primaryLabels).length === 0 &&
                  (!showOthers || applyLimitFilter(extraLabels).length === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      Nenhuma categoria com limite definido.
                    </p>
                  )}
              </>
            )}
          </div>
        </Card>

        {monthBucket && monthly.items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Nenhum gasto registrado em {monthBucket.longLabel}.
          </p>
        )}
      </section>

      {/* ============= Dialog de orçamento (somente categoria-pai) ============= */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlgEditingId ? "Editar limite" : "Definir limite"}</DialogTitle>
            <DialogDescription>
              {dlgParentLabel
                ? `Limite mensal para a categoria "${dlgParentLabel}".`
                : "Defina um limite mensal para a categoria."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <div className="text-sm font-medium text-foreground">{dlgParentLabel || "—"}</div>
            </div>

            <div className="space-y-1.5">
              <Label>Limite mensal (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="800,00"
                value={dlgLimit}
                onChange={(e) => { setDlgLimit(e.target.value); setDlgError(null); }}
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Avisar ao atingir</Label>
                <span className="text-sm font-medium text-foreground tabular-nums">{dlgThreshold}%</span>
              </div>
              <Slider
                min={50}
                max={100}
                step={5}
                value={[dlgThreshold]}
                onValueChange={(v) => setDlgThreshold(v[0])}
              />
            </div>

            {dlgError && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{dlgError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>Cancelar</Button>
            <Button
              onClick={saveBudget}
              className="bg-gradient-primary text-primary-foreground hover:opacity-90"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/**
 * Distribui matizes (HSL) igualmente entre N categorias para o donut.
 * Mantém saturação/lightness do design system.
 */
function pickHue(idx: number, total: number): string {
  const step = total > 0 ? 360 / total : 30;
  const hue = Math.round((idx * step + 12) % 360);
  return `hsl(${hue} 70% 55%)`;
}

export default Categorizacao;
