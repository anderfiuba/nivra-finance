import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  HelpCircle,
  PencilLine,
  Plus,
  Tags,
  Trash2,
} from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { formatBRL, formatDate } from "@/lib/format";
import { Transaction } from "@/data/mockData";
import { toast } from "sonner";

const Categorizacao = () => {
  const {
    pendingList,
    pendingByType,
    categories,
    updateCategory,
    budgetProgress,
    categoryBudgets,
    expensesByCategoryCycle,
    upsertBudget,
    deleteBudget,
    currentCycleLabel,
  } = useFinance();

  const [draftCategory, setDraftCategory] = useState<Record<string, string>>({});
  const [budgetDialogLabel, setBudgetDialogLabel] = useState<string | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [draftLimit, setDraftLimit] = useState<string>("");
  const [draftThreshold, setDraftThreshold] = useState<number>(80);

  // Apenas categorias PAI (top-level Pluggy). Lista enxuta para a UI.
  const parentCategories = useMemo(() => {
    return categories
      .filter((c) => c.parentId === null)
      .map((c) => ({ id: c.id, label: c.descriptionTranslated ?? c.description }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories]);

  // Mantemos apenas itens "sem categoria" na fila de pendências.
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

  // ----- Orçamentos -----

  // Lista combinada: orçamentos definidos + categorias com gasto sem orçamento.
  const budgetRows = useMemo(() => {
    const withBudget = budgetProgress.map((b) => ({
      label: b.categoryLabel,
      spent: b.spent,
      limit: b.limit,
      threshold: b.threshold,
      ratio: b.ratio,
      status: b.status,
      budgetId: b.budgetId,
    }));
    const withBudgetLabels = new Set(withBudget.map((b) => b.label));
    const expensesOnly = expensesByCategoryCycle
      .filter((e) => !withBudgetLabels.has(e.name))
      .map((e) => ({
        label: e.name,
        spent: e.value,
        limit: 0,
        threshold: 0.8,
        ratio: 0,
        status: "ok" as const,
        budgetId: null as string | null,
      }));
    return [...withBudget, ...expensesOnly].sort((a, b) => b.spent - a.spent);
  }, [budgetProgress, expensesByCategoryCycle]);

  const openBudgetDialog = (label: string | null) => {
    setBudgetDialogLabel(label);
    if (label) {
      const existing = categoryBudgets.find((b) => b.categoryLabel === label);
      setDraftLimit(existing ? String(existing.monthlyLimit) : "");
      setDraftThreshold(existing ? Math.round(existing.alertThreshold * 100) : 80);
    } else {
      setDraftLimit("");
      setDraftThreshold(80);
    }
    setBudgetDialogOpen(true);
  };

  const saveBudget = async () => {
    if (!budgetDialogLabel) {
      toast.error("Escolha uma categoria.");
      return;
    }
    const limit = Number(draftLimit.replace(",", "."));
    if (!Number.isFinite(limit) || limit <= 0) {
      toast.error("Informe um limite válido.");
      return;
    }
    await upsertBudget(budgetDialogLabel, limit, draftThreshold / 100);
    setBudgetDialogOpen(false);
    toast.success("Orçamento salvo.");
  };

  const removeBudget = async (id: string) => {
    await deleteBudget(id);
    toast.success("Orçamento removido.");
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Categorias</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Classifique pendências e defina limites de gastos mensais por categoria.
        </p>
      </div>

      <Tabs defaultValue={semCategoriaCount > 0 ? "pendentes" : "orcamentos"}>
        <TabsList>
          <TabsTrigger value="pendentes">
            Pendentes
            {semCategoriaCount > 0 && (
              <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                {semCategoriaCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="orcamentos">Orçamentos</TabsTrigger>
        </TabsList>

        {/* ------- Aba Pendentes ------- */}
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
                  {/* Identificação */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                      t.type === "entrada" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}>
                      {t.type === "entrada" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-xs h-5 border-border bg-secondary/50 inline-flex items-center gap-1"
                        >
                          <HelpCircle className="h-3 w-3" /> Sem categoria
                        </Badge>
                        <span className="text-xs text-muted-foreground">{t.account}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Valor */}
                  <p
                    className={`text-sm font-semibold shrink-0 lg:w-28 lg:text-right ${
                      t.type === "entrada" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {t.type === "entrada" ? "+" : "−"}
                    {formatBRL(t.value)}
                  </p>

                  {/* Ações contextuais */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <Select
                      value={draft}
                      onValueChange={(v) => setDraftCategory((p) => ({ ...p, [t.id]: v }))}
                    >
                      <SelectTrigger className="w-44 h-9 bg-input border-border" aria-label="Definir categoria">
                        <SelectValue placeholder="Definir categoria" />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {parentCategories.length === 0 ? (
                          <SelectItem value="__none" disabled>Carregando…</SelectItem>
                        ) : (
                          parentCategories.map((it) => (
                            <SelectItem key={it.id} value={it.label}>{it.label}</SelectItem>
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

        {/* ------- Aba Orçamentos ------- */}
        <TabsContent value="orcamentos" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <Tags className="h-3.5 w-3.5" /> Ciclo atual: <span className="font-medium text-foreground">{currentCycleLabel}</span>
            </p>
            <Button
              size="sm"
              onClick={() => openBudgetDialog(null)}
              className="bg-gradient-primary text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-1" /> Novo orçamento
            </Button>
          </div>

          <Card className="bg-gradient-card border-border overflow-hidden">
            {budgetRows.length === 0 ? (
              <div className="p-12 text-center">
                <Tags className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-base font-semibold text-foreground">Nenhum orçamento ainda</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Defina limites mensais para acompanhar seus gastos por categoria.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {budgetRows.map((row) => {
                  const hasBudget = row.budgetId !== null;
                  const pct = hasBudget ? Math.min(100, row.ratio * 100) : 0;
                  const barTone =
                    row.status === "over"
                      ? "[&>div]:bg-destructive"
                      : row.status === "alert"
                        ? "[&>div]:bg-warning"
                        : "[&>div]:bg-primary";
                  return (
                    <div key={row.label} className="p-4 md:p-5 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{row.label}</p>
                          {hasBudget ? (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatBRL(row.spent)} de {formatBRL(row.limit)}
                              <span className="ml-1">({(row.ratio * 100).toFixed(0)}%)</span>
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Gasto no ciclo: {formatBRL(row.spent)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          {row.status === "over" && (
                            <Badge variant="outline" className="text-[10px] h-5 border-destructive/30 bg-destructive/10 text-destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" /> Estourou
                            </Badge>
                          )}
                          {row.status === "alert" && (
                            <Badge variant="outline" className="text-[10px] h-5 border-warning/30 bg-warning/10 text-warning">
                              <AlertTriangle className="h-3 w-3 mr-1" /> Próximo do limite
                            </Badge>
                          )}
                          {hasBudget ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => openBudgetDialog(row.label)}>
                                <PencilLine className="h-3.5 w-3.5 mr-1" /> Editar
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                onClick={() => row.budgetId && removeBudget(row.budgetId)}
                                aria-label="Remover orçamento"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => openBudgetDialog(row.label)}>
                              <Plus className="h-3.5 w-3.5 mr-1" /> Definir limite
                            </Button>
                          )}
                        </div>
                      </div>
                      {hasBudget && (
                        <Progress value={pct} className={`h-2 ${barTone}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: novo / editar orçamento */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{budgetDialogLabel ? "Editar orçamento" : "Novo orçamento"}</DialogTitle>
            <DialogDescription>
              Defina um limite mensal e o percentual a partir do qual queremos te avisar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!budgetDialogLabel && (
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={budgetDialogLabel ?? ""} onValueChange={(v) => setBudgetDialogLabel(v)}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {parentCategories.map((it) => (
                      <SelectItem key={it.id} value={it.label}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {budgetDialogLabel && (
              <div className="text-sm text-muted-foreground">
                Categoria: <span className="font-medium text-foreground">{budgetDialogLabel}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Limite mensal (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="800,00"
                value={draftLimit}
                onChange={(e) => setDraftLimit(e.target.value)}
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Avisar ao atingir</Label>
                <span className="text-sm font-medium text-foreground tabular-nums">{draftThreshold}%</span>
              </div>
              <Slider
                min={50}
                max={100}
                step={5}
                value={[draftThreshold]}
                onValueChange={(v) => setDraftThreshold(v[0])}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetDialogOpen(false)}>Cancelar</Button>
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
