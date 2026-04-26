import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  PencilLine,
  Plus,
  Tags,
  Trash2,
  Wallet,
} from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { formatBRL, formatDate } from "@/lib/format";
import { Transaction } from "@/data/mockData";
import { lastNMonths, currentMonthBucket } from "@/lib/months";
import { MonthSelector } from "@/components/extrato/MonthSelector";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type BudgetScope = "parent" | "child";

const Categorizacao = () => {
  const {
    pendingList,
    pendingByType,
    categories,
    updateCategory,
    categoryBudgets,
    monthlyCategoryAggregates,
    upsertBudget,
    deleteBudget,
  } = useFinance();

  // ---------- estado ----------
  const months = useMemo(() => lastNMonths(12), []);
  const [monthKey, setMonthKey] = useState<string>(currentMonthBucket().key);

  const [draftCategory, setDraftCategory] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // dialog
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgScope, setDlgScope] = useState<BudgetScope>("parent");
  const [dlgParentLabel, setDlgParentLabel] = useState<string>(""); // pai do orçamento (quando child) OU rótulo do próprio (parent)
  const [dlgChildLabel, setDlgChildLabel] = useState<string>("");
  const [dlgLimit, setDlgLimit] = useState<string>("");
  const [dlgThreshold, setDlgThreshold] = useState<number>(80);
  const [dlgEditingId, setDlgEditingId] = useState<string | null>(null);
  const [dlgError, setDlgError] = useState<string | null>(null);

  // ---------- derivados ----------
  const monthly = useMemo(() => monthlyCategoryAggregates(monthKey), [monthlyCategoryAggregates, monthKey]);
  const monthBucket = useMemo(() => months.find((m) => m.key === monthKey) ?? months[0], [months, monthKey]);

  const parentCategoryLabels = useMemo(() => {
    return categories
      .filter((c) => c.parentId === null)
      .map((c) => c.descriptionTranslated ?? c.description)
      .sort((a, b) => a.localeCompare(b));
  }, [categories]);

  // Mapa: rótulo da categoria pai → lista de rótulos de subcategorias (filhas) do catálogo Pluggy.
  // Usado para popular o Select de subcategoria no diálogo de orçamento, evitando erros de digitação.
  const childLabelsByParentLabel = useMemo(() => {
    const parentIdToLabel = new Map<string, string>();
    for (const c of categories) {
      if (c.parentId === null) {
        parentIdToLabel.set(c.id, c.descriptionTranslated ?? c.description);
      }
    }
    const map = new Map<string, string[]>();
    for (const c of categories) {
      if (!c.parentId) continue;
      const parentLabel = parentIdToLabel.get(c.parentId);
      if (!parentLabel) continue;
      const childLabel = c.descriptionTranslated ?? c.description;
      const arr = map.get(parentLabel) ?? [];
      arr.push(childLabel);
      map.set(parentLabel, arr);
    }
    for (const [k, arr] of map) {
      map.set(k, Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b)));
    }
    return map;
  }, [categories]);

  // Subcategorias disponíveis para o pai selecionado no diálogo. Inclui também quaisquer
  // rótulos de filhas que apareceram nas transações do mês mas não estão no catálogo.
  const dlgChildOptions = useMemo(() => {
    if (!dlgParentLabel) return [] as string[];
    const fromCatalog = childLabelsByParentLabel.get(dlgParentLabel) ?? [];
    const fromMonth = (monthly.items.find((i) => i.parentLabel === dlgParentLabel)?.children ?? []).map(
      (c) => c.label,
    );
    return Array.from(new Set([...fromCatalog, ...fromMonth])).sort((a, b) => a.localeCompare(b));
  }, [childLabelsByParentLabel, monthly.items, dlgParentLabel]);

  // Mapas auxiliares para encontrar orçamento por (parent | parent::child)
  const budgetByParent = useMemo(() => {
    const m = new Map<string, typeof categoryBudgets[number]>();
    for (const b of categoryBudgets) if (b.scope === "parent") m.set(b.categoryLabel, b);
    return m;
  }, [categoryBudgets]);
  const budgetByChildKey = useMemo(() => {
    const m = new Map<string, typeof categoryBudgets[number]>();
    for (const b of categoryBudgets) {
      if (b.scope === "child" && b.parentCategoryLabel) {
        m.set(`${b.parentCategoryLabel}::${b.categoryLabel}`, b);
      }
    }
    return m;
  }, [categoryBudgets]);

  // ---------- pendentes ----------
  const visible = pendingList.filter((t) => t.pendingType === "sem_categoria");
  const semCategoriaCount = pendingByType.sem_categoria;

  const handleSaveCategory = (t: Transaction) => {
    const value = draftCategory[t.id];
    if (!value) {
      toast.error("Selecione uma categoria antes de salvar.");
      return;
    }
    updateCategory(t.id, value);
    setDraftCategory((prev) => {
      const next = { ...prev };
      delete next[t.id];
      return next;
    });
    toast.success("Categoria atualizada");
  };

  // ---------- abrir/fechar dialog ----------
  const openNewBudget = (scope: BudgetScope, parentLabel: string, childLabel?: string) => {
    setDlgScope(scope);
    setDlgParentLabel(parentLabel);
    setDlgChildLabel(childLabel ?? "");
    setDlgLimit("");
    setDlgThreshold(80);
    setDlgEditingId(null);
    setDlgError(null);
    setDlgOpen(true);
  };

  const openEditBudget = (budgetId: string) => {
    const b = categoryBudgets.find((x) => x.id === budgetId);
    if (!b) return;
    setDlgScope(b.scope);
    if (b.scope === "child") {
      setDlgParentLabel(b.parentCategoryLabel ?? "");
      setDlgChildLabel(b.categoryLabel);
    } else {
      setDlgParentLabel(b.categoryLabel);
      setDlgChildLabel("");
    }
    setDlgLimit(String(b.monthlyLimit));
    setDlgThreshold(Math.round(b.alertThreshold * 100));
    setDlgEditingId(b.id);
    setDlgError(null);
    setDlgOpen(true);
  };

  // ---------- validação hierárquica ----------
  const validateBudget = (
    scope: BudgetScope,
    parentLabel: string,
    childLabel: string,
    limit: number,
  ): string | null => {
    if (scope === "child") {
      if (!parentLabel) return "Escolha a categoria principal.";
      if (!childLabel) return "Escolha a subcategoria.";
      const parentBudget = budgetByParent.get(parentLabel);
      // soma das outras filhas do mesmo pai (excluindo a edição atual)
      let siblingSum = 0;
      for (const b of categoryBudgets) {
        if (b.scope !== "child") continue;
        if (b.parentCategoryLabel !== parentLabel) continue;
        if (b.id === dlgEditingId) continue;
        if (b.categoryLabel === childLabel && !dlgEditingId) continue; // novo cobre o existente
        siblingSum += b.monthlyLimit;
      }
      if (parentBudget && siblingSum + limit > parentBudget.monthlyLimit + 0.001) {
        return `O limite total das subcategorias (${formatBRL(siblingSum + limit)}) não pode passar do limite da categoria "${parentLabel}" (${formatBRL(parentBudget.monthlyLimit)}).`;
      }
      return null;
    }
    // scope === "parent"
    if (!parentLabel) return "Escolha a categoria.";
    let childrenSum = 0;
    for (const b of categoryBudgets) {
      if (b.scope === "child" && b.parentCategoryLabel === parentLabel) {
        childrenSum += b.monthlyLimit;
      }
    }
    if (childrenSum > 0 && limit < childrenSum - 0.001) {
      return `O limite da categoria principal precisa ser pelo menos ${formatBRL(childrenSum)} (soma das subcategorias já definidas).`;
    }
    return null;
  };

  const saveBudget = async () => {
    const limit = Number(dlgLimit.replace(",", "."));
    if (!Number.isFinite(limit) || limit <= 0) {
      setDlgError("Informe um limite válido.");
      return;
    }
    const err = validateBudget(dlgScope, dlgParentLabel, dlgChildLabel, limit);
    if (err) {
      setDlgError(err);
      return;
    }
    const label = dlgScope === "child" ? dlgChildLabel : dlgParentLabel;
    const parentRef = dlgScope === "child" ? dlgParentLabel : null;
    await upsertBudget(label, limit, dlgThreshold / 100, dlgScope, parentRef);
    setDlgOpen(false);
    toast.success("Orçamento salvo.");
  };

  const removeBudget = async (id: string) => {
    await deleteBudget(id);
    toast.success("Orçamento removido.");
  };

  // Reset expanded ao trocar de mês para evitar estados órfãos
  useEffect(() => {
    setExpanded({});
  }, [monthKey]);

  // ============== render ==============
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto border-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Categorias</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe seus gastos por categoria e defina limites mensais.
        </p>
      </div>

      <Tabs defaultValue="categorias">
        <TabsList>
          <TabsTrigger value="categorias">Por categoria</TabsTrigger>
          <TabsTrigger value="pendentes">
            Pendentes
            {semCategoriaCount > 0 && (
              <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                {semCategoriaCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ========== Aba Por categoria ========== */}
        <TabsContent value="categorias" className="space-y-4">
          {/* Header: mês + total */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <MonthSelector months={months} value={monthKey} onChange={setMonthKey} />
            <div className="flex items-center gap-3 text-sm">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Total gasto:</span>
              <span className="font-semibold tabular-nums text-foreground">{formatBRL(monthly.total)}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {monthly.items.length} {monthly.items.length === 1 ? "categoria" : "categorias"}
              </span>
            </div>
          </div>

          <Card className="bg-gradient-card border-border overflow-hidden">
            {monthly.items.length === 0 ? (
              <div className="p-12 text-center">
                <Tags className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-base font-semibold text-foreground">Nenhum gasto registrado em {monthBucket?.longLabel}.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quando uma transação chegar, ela aparece aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-border p-2 md:p-0">
                {monthly.items.map((item) => {
                  const isOpen = !!expanded[item.parentLabel];
                  const parentBudget = budgetByParent.get(item.parentLabel);
                  const ratio = parentBudget && parentBudget.monthlyLimit > 0
                    ? item.spent / parentBudget.monthlyLimit
                    : 0;
                  const status: "ok" | "alert" | "over" = !parentBudget
                    ? "ok"
                    : ratio >= 1
                      ? "over"
                      : ratio >= parentBudget.alertThreshold
                        ? "alert"
                        : "ok";
                  // Para visual sem orçamento: barra mostrando % do total
                  const visualPct = parentBudget
                    ? Math.min(100, ratio * 100)
                    : Math.round(item.pctOfTotal * 100);
                  const barTone = !parentBudget
                    ? "[&>div]:bg-primary/40"
                    : status === "over"
                      ? "[&>div]:bg-destructive"
                      : status === "alert"
                        ? "[&>div]:bg-warning"
                        : "[&>div]:bg-primary";

                  return (
                    <Collapsible
                      key={item.parentLabel}
                      className="border border-none border-secondary"
                      open={isOpen}
                      onOpenChange={(o) => setExpanded((p) => ({ ...p, [item.parentLabel]: o }))}
                    >
                      <div className="p-3.5 md:p-5 space-y-3 rounded-lg bg-card/40 md:rounded-none md:border-0 md:bg-transparent py-[25px] mx-[5px] px-[25px] border-primary border">
                        <div className="flex items-start gap-2 md:gap-3">
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="flex items-start gap-2 md:gap-3 flex-1 min-w-0 text-left group"
                              aria-label={`Expandir ${item.parentLabel}`}
                            >
                              <ChevronRight
                                className={cn(
                                  "h-4 w-4 mt-1 shrink-0 text-muted-foreground transition-transform",
                                  isOpen && "rotate-90",
                                )}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-foreground truncate group-hover:underline">
                                    {item.parentLabel}
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
                                    ? `${formatBRL(item.spent)} de ${formatBRL(parentBudget.monthlyLimit)} · ${(ratio * 100).toFixed(0)}%`
                                    : `${(item.pctOfTotal * 100).toFixed(0)}% do total do mês`}
                                </p>
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold tabular-nums text-foreground whitespace-nowrap">
                              {formatBRL(item.spent)}
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
                                  onClick={() => openNewBudget("parent", item.parentLabel)}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Limite
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        <Progress value={visualPct} className={`h-1.5 ${barTone}`} />
                        {/* Ações em dispositivos pequenos: ficam abaixo da barra para não apertar o título */}
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
                              onClick={() => openNewBudget("parent", item.parentLabel)}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Definir limite
                            </Button>
                          )}
                        </div>

                        <CollapsibleContent>
                          <div className="mt-3 ml-2 md:ml-7 space-y-3 md:space-y-2 border-l border-border pl-3 md:pl-4">
                            {item.children.map((c) => {
                              const childBudget = budgetByChildKey.get(`${item.parentLabel}::${c.label}`);
                              const cRatio = childBudget && childBudget.monthlyLimit > 0
                                ? c.spent / childBudget.monthlyLimit
                                : 0;
                              const cStatus: "ok" | "alert" | "over" = !childBudget
                                ? "ok"
                                : cRatio >= 1
                                  ? "over"
                                  : cRatio >= childBudget.alertThreshold
                                    ? "alert"
                                    : "ok";
                              const cVisual = childBudget
                                ? Math.min(100, cRatio * 100)
                                : Math.round(c.pctOfParent * 100);
                              const cBar = !childBudget
                                ? "[&>div]:bg-muted-foreground/30"
                                : cStatus === "over"
                                  ? "[&>div]:bg-destructive"
                                  : cStatus === "alert"
                                    ? "[&>div]:bg-warning"
                                    : "[&>div]:bg-primary";
                              return (
                                <div key={c.label} className="py-1.5">
                                  <div className="flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-xs font-medium text-foreground truncate">{c.label}</p>
                                        {childBudget && (
                                          <Badge variant="outline" className="text-[10px] h-4 border-border bg-secondary/40">
                                            Limite {formatBRL(childBudget.monthlyLimit)}
                                          </Badge>
                                        )}
                                        {cStatus === "over" && (
                                          <Badge variant="outline" className="text-[10px] h-4 border-destructive/30 bg-destructive/10 text-destructive">
                                            Estourou
                                          </Badge>
                                        )}
                                        {cStatus === "alert" && (
                                          <Badge variant="outline" className="text-[10px] h-4 border-warning/30 bg-warning/10 text-warning">
                                            Próximo
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                                        {childBudget
                                          ? `${formatBRL(c.spent)} de ${formatBRL(childBudget.monthlyLimit)} · ${(cRatio * 100).toFixed(0)}%`
                                          : `${(c.pctOfParent * 100).toFixed(0)}% de ${item.parentLabel}`}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-xs font-semibold tabular-nums text-foreground">{formatBRL(c.spent)}</p>
                                      <div className="mt-1 flex items-center gap-1 justify-end">
                                        {childBudget ? (
                                          <>
                                            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => openEditBudget(childBudget.id)}>
                                              <PencilLine className="h-3 w-3 mr-1" /> Editar
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                              onClick={() => removeBudget(childBudget.id)}
                                              aria-label="Remover orçamento"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </>
                                        ) : (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 text-[10px] px-2"
                                            onClick={() => openNewBudget("child", item.parentLabel, c.label)}
                                          >
                                            <Plus className="h-3 w-3 mr-1" /> Limite
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <Progress value={cVisual} className={`h-1 mt-1.5 ${cBar}`} />
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ========== Aba Pendentes ========== */}
        <TabsContent value="pendentes" className="space-y-4">
          <Card className="bg-gradient-card border-border overflow-hidden">
            {visible.length === 0 ? (
              <div className="p-16 text-center">
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <p className="text-base font-semibold text-foreground">Tudo em dia</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nenhuma pendência no momento. Volte depois da próxima sincronização.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {visible.map((t) => {
                  const draft = draftCategory[t.id] ?? "";
                  return (
                    <div key={t.id} className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                          t.type === "entrada" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                        }`}>
                          {t.type === "entrada" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs h-5 border-border bg-secondary/50 inline-flex items-center gap-1">
                              <HelpCircle className="h-3 w-3" /> Sem categoria
                            </Badge>
                            <span className="text-xs text-muted-foreground">{t.account}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                          </div>
                        </div>
                      </div>
                      <p className={`text-sm font-semibold shrink-0 lg:w-28 lg:text-right ${
                        t.type === "entrada" ? "text-success" : "text-destructive"
                      }`}>
                        {t.type === "entrada" ? "+" : "−"}
                        {formatBRL(t.value)}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <Select
                          value={draft}
                          onValueChange={(v) => setDraftCategory((p) => ({ ...p, [t.id]: v }))}
                        >
                          <SelectTrigger className="w-44 h-9 bg-input border-border" aria-label="Definir categoria">
                            <SelectValue placeholder="Definir categoria" />
                          </SelectTrigger>
                          <SelectContent className="max-h-80">
                            {parentCategoryLabels.length === 0 ? (
                              <SelectItem value="__none" disabled>Carregando…</SelectItem>
                            ) : (
                              parentCategoryLabels.map((label) => (
                                <SelectItem key={label} value={label}>{label}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="bg-gradient-primary text-primary-foreground hover:opacity-90"
                          onClick={() => handleSaveCategory(t)}
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============= Dialog de orçamento ============= */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlgEditingId ? "Editar orçamento" : "Novo orçamento"}</DialogTitle>
            <DialogDescription>
              Defina um limite mensal e o percentual a partir do qual queremos te avisar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tipo de orçamento */}
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <div className="inline-flex rounded-md border border-border bg-secondary/40 p-0.5">
                <button
                  type="button"
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-sm transition-colors",
                    dlgScope === "parent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => { setDlgScope("parent"); setDlgChildLabel(""); setDlgError(null); }}
                  disabled={!!dlgEditingId}
                >
                  Categoria principal
                </button>
                <button
                  type="button"
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-sm transition-colors",
                    dlgScope === "child" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => { setDlgScope("child"); setDlgError(null); }}
                  disabled={!!dlgEditingId}
                >
                  Subcategoria
                </button>
              </div>
            </div>

            {/* Categoria principal (sempre visível) */}
            <div className="space-y-1.5">
              <Label>Categoria principal</Label>
              {dlgEditingId ? (
                <div className="text-sm font-medium text-foreground">{dlgParentLabel || "—"}</div>
              ) : (
                <Select value={dlgParentLabel} onValueChange={(v) => { setDlgParentLabel(v); setDlgError(null); }}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Selecione a categoria principal" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {parentCategoryLabels.map((label) => (
                      <SelectItem key={label} value={label}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Subcategoria */}
            {dlgScope === "child" && (
              <div className="space-y-1.5">
                <Label>Subcategoria</Label>
                {dlgEditingId ? (
                  <div className="text-sm font-medium text-foreground">{dlgChildLabel || "—"}</div>
                ) : (
                  <Select
                    value={dlgChildLabel}
                    onValueChange={(v) => { setDlgChildLabel(v); setDlgError(null); }}
                    disabled={!dlgParentLabel || dlgChildOptions.length === 0}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue
                        placeholder={
                          !dlgParentLabel
                            ? "Escolha a categoria principal primeiro"
                            : dlgChildOptions.length === 0
                              ? "Nenhuma subcategoria disponível"
                              : "Selecione a subcategoria"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {dlgChildOptions.map((label) => (
                        <SelectItem key={label} value={label}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[11px] text-muted-foreground">
                  As subcategorias são as mesmas que aparecem nas suas transações.
                </p>
              </div>
            )}

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