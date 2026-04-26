import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
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
  Wallet,
} from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { formatBRL } from "@/lib/format";
import { MonthSelector } from "@/components/extrato/MonthSelector";
import { CycleDaySettingsButton } from "@/components/CycleDaySettingsButton";
import { DEFAULT_PARENT_CATEGORIES } from "@/lib/defaultCategories";
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
  } = useFinance();

  // ---------- estado ----------
  const cycles = useMemo(() => lastCycles(12), [lastCycles]);
  const [monthKey, setMonthKey] = useState<string>(cycles[0]?.key ?? "");
  useEffect(() => {
    if (cycles[0] && !cycles.some((c) => c.key === monthKey)) {
      setMonthKey(cycles[0].key);
    }
  }, [cycles, monthKey]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showOthers, setShowOthers] = useState(false);

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
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto border-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Categorias</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe seus gastos por categoria e defina limites mensais.
        </p>
      </div>

      <div className="space-y-4">
        {/* Header: ciclo + total */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <MonthSelector months={cycles} value={monthKey} onChange={setMonthKey} />
            <CycleDaySettingsButton />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Total gasto:</span>
            <span className="font-semibold tabular-nums text-foreground">{formatBRL(monthly.total)}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {monthly.items.length} {monthly.items.length === 1 ? "categoria com gasto" : "categorias com gasto"}
            </span>
          </div>
        </div>

        <Card className="bg-gradient-card border-border overflow-hidden">
          <div className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-border p-2 md:p-0">
            {primaryLabels.map((label) => renderRow(label))}
          </div>
        </Card>

        {/* Toggle: outras categorias do catálogo */}
        {extraLabels.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <Label
                htmlFor="cat-show-others"
                className="text-xs text-muted-foreground cursor-pointer select-none"
              >
                Mostrar outras categorias
              </Label>
              <Switch
                id="cat-show-others"
                checked={showOthers}
                onCheckedChange={setShowOthers}
              />
            </div>

            {showOthers && (
              <Card className="bg-gradient-card border-border overflow-hidden">
                <div className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-border p-2 md:p-0">
                  {extraLabels.map((label) => renderRow(label))}
                </div>
              </Card>
            )}
          </div>
        )}

        {monthBucket && monthly.items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Nenhum gasto registrado em {monthBucket.longLabel}.
          </p>
        )}
      </div>

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

export default Categorizacao;
