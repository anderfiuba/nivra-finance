import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, PencilLine, Plus, Trash2 } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  /** Total já gasto no mês (somado das categorias com orçamento). */
  spent: number;
}

/**
 * Card que mostra (e permite definir) o LIMITE TOTAL mensal do usuário.
 * Quando definido, vira o "teto" do card hero. Também avisa visualmente
 * quando a soma dos limites por categoria excede o teto.
 */
export function TotalBudgetCard({ spent }: Props) {
  const {
    totalBudget,
    parentBudgetsSum,
    upsertTotalBudget,
    deleteTotalBudget,
  } = useFinance();

  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState("");
  const [threshold, setThreshold] = useState(80);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLimit(totalBudget ? String(totalBudget.monthlyLimit) : "");
    setThreshold(totalBudget ? Math.round(totalBudget.alertThreshold * 100) : 80);
  }, [open, totalBudget]);

  const overBy = useMemo(() => {
    if (!totalBudget) return 0;
    return Math.max(0, parentBudgetsSum - totalBudget.monthlyLimit);
  }, [totalBudget, parentBudgetsSum]);

  const remaining = totalBudget ? totalBudget.monthlyLimit - spent : 0;
  const ratio =
    totalBudget && totalBudget.monthlyLimit > 0
      ? Math.min(1, spent / totalBudget.monthlyLimit)
      : 0;

  const handleSave = async () => {
    const value = Number(limit.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    // Avisa (não bloqueia) caso o teto fique abaixo da soma já definida em categorias.
    if (parentBudgetsSum > value + 0.001) {
      toast.warning(
        `Atenção: já existem ${formatBRL(
          parentBudgetsSum,
        )} em limites por categoria — acima desse novo teto.`,
      );
    }
    setSaving(true);
    try {
      await upsertTotalBudget(value, threshold / 100);
      toast.success("Limite total salvo");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteTotalBudget();
      toast.success("Limite total removido");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  // Estado vazio: convite minimalista para definir.
  if (!totalBudget) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-left rounded-xl border border-dashed border-border/70 bg-card/30 p-3.5 hover:bg-card/60 transition-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Definir limite total do mês
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Um teto geral para todos os seus gastos.
              </p>
            </div>
            <span className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground shrink-0">
              <Plus className="h-3.5 w-3.5" />
              Definir
            </span>
          </div>
        </button>
        {renderDialog()}
      </>
    );
  }

  // Estado normal: mostra teto + barra + atalho editar.
  return (
    <>
      <Card
        className={cn(
          "bg-gradient-card border-border p-4 md:p-5 space-y-3",
          overBy > 0 && "border-warning/50",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Limite total do mês
            </p>
            <p className="text-2xl font-semibold tabular-nums text-foreground mt-0.5">
              {formatBRL(totalBudget.monthlyLimit)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs shrink-0"
            onClick={() => setOpen(true)}
          >
            <PencilLine className="h-3.5 w-3.5 mr-1" />
            Editar
          </Button>
        </div>

        <Progress
          value={ratio * 100}
          className={cn(
            "h-1.5",
            ratio >= 1
              ? "[&>div]:bg-destructive"
              : ratio >= totalBudget.alertThreshold
                ? "[&>div]:bg-warning"
                : "[&>div]:bg-primary",
          )}
        />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>{formatBRL(spent)} gastos</span>
          <span
            className={cn(
              remaining < 0 ? "text-destructive font-medium" : "",
            )}
          >
            {remaining >= 0
              ? `${formatBRL(remaining)} restam`
              : `${formatBRL(Math.abs(remaining))} acima`}
          </span>
        </div>

        {overBy > 0 && (
          <div className="flex items-start gap-2 text-xs rounded-md border border-warning/30 bg-warning/10 text-warning p-2.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              A soma dos limites das categorias ({formatBRL(parentBudgetsSum)}) está{" "}
              {formatBRL(overBy)} acima do teto. Reduza algum limite por categoria
              ou aumente o limite total.
            </span>
          </div>
        )}
      </Card>
      {renderDialog()}
    </>
  );

  function renderDialog() {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {totalBudget ? "Editar limite total" : "Definir limite total"}
            </DialogTitle>
            <DialogDescription>
              Um teto único para todos os seus gastos do mês. A soma dos limites por
              categoria não poderá ultrapassar esse valor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="total-limit">Limite mensal (R$)</Label>
              <Input
                id="total-limit"
                inputMode="decimal"
                placeholder="3000,00"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="h-11 bg-input border-border"
              />
              {parentBudgetsSum > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Soma atual dos limites por categoria:{" "}
                  <span className="text-foreground tabular-nums font-medium">
                    {formatBRL(parentBudgetsSum)}
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <Label className="text-muted-foreground">Avisar a partir de</Label>
                <span className="tabular-nums font-medium text-foreground">
                  {threshold}%
                </span>
              </div>
              <Slider
                value={[threshold]}
                onValueChange={(v) => setThreshold(v[0] ?? 80)}
                min={50}
                max={100}
                step={5}
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2">
            {totalBudget && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={saving}
                aria-label="Remover limite total"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}