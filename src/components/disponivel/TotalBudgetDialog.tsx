import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Gasto atual do ciclo — só usado pra contexto visual. */
  spent?: number;
}

/**
 * Modal isolado para definir/editar/remover o LIMITE TOTAL do ciclo.
 * Mesma lógica do antigo TotalBudgetCard — extraída para que a Pocket View
 * possa renderizar apenas widgets sem o card auxiliar.
 */
export function TotalBudgetDialog({ open, onOpenChange }: Props) {
  const { totalBudget, parentBudgetsSum, upsertTotalBudget, deleteTotalBudget } = useFinance();
  const [limit, setLimit] = useState("");
  const [threshold, setThreshold] = useState(80);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLimit(totalBudget ? String(totalBudget.monthlyLimit) : "");
    setThreshold(totalBudget ? Math.round(totalBudget.alertThreshold * 100) : 80);
  }, [open, totalBudget]);

  const handleSave = async () => {
    const value = Number(limit.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (parentBudgetsSum > value + 0.001) {
      toast.warning(
        `Atenção: já existem ${formatBRL(parentBudgetsSum)} em limites por categoria — acima desse novo teto.`,
      );
    }
    setSaving(true);
    try {
      await upsertTotalBudget(value, threshold / 100);
      toast.success("Limite total salvo");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteTotalBudget();
      toast.success("Limite total removido");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{totalBudget ? "Editar limite total" : "Definir limite total"}</DialogTitle>
          <DialogDescription>
            Um teto único para todos os seus gastos do ciclo. A soma dos limites por categoria não
            poderá ultrapassar esse valor.
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
              <span className="tabular-nums font-medium text-foreground">{threshold}%</span>
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
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
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