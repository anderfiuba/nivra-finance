import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ArrowRight, Trash2 } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Quando passado, edita um orçamento existente (modo edit). */
  budgetId?: string | null;
  /** Categoria pai. Sempre obrigatório. */
  categoryLabel: string;
  /** Quando definido, é orçamento de subcategoria. */
  parentCategoryLabel?: string | null;
}

/**
 * Bottom sheet (mobile) / drawer (desktop) com:
 * - Edição rápida do limite (input + slider).
 * - 5 últimas transações da categoria no mês corrente.
 * - Link para o extrato filtrado.
 * - Remover orçamento (quando em modo edit).
 */
export function CategorySheet({
  open,
  onOpenChange,
  budgetId,
  categoryLabel,
  parentCategoryLabel = null,
}: Props) {
  const { categoryBudgets, monthTransactions, upsertBudget, deleteBudget } = useFinance();

  const existing = useMemo(
    () => categoryBudgets.find((b) => b.id === budgetId) ?? null,
    [categoryBudgets, budgetId],
  );

  const [limit, setLimit] = useState<string>("");
  const [threshold, setThreshold] = useState<number>(80);
  const [saving, setSaving] = useState(false);

  // (re)inicializa quando abre
  useEffect(() => {
    if (!open) return;
    setLimit(existing ? String(existing.monthlyLimit) : "");
    setThreshold(existing ? Math.round(existing.alertThreshold * 100) : 80);
  }, [open, existing]);

  const recentTxs = useMemo(() => {
    return monthTransactions
      .filter((t) => t.type === "saida" && (t.category ?? "") === categoryLabel)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [monthTransactions, categoryLabel]);

  const handleSave = async () => {
    const value = Number(limit.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    setSaving(true);
    try {
      await upsertBudget(
        categoryLabel,
        value,
        threshold / 100,
        parentCategoryLabel ? "child" : "parent",
        parentCategoryLabel,
      );
      toast.success("Limite salvo");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await deleteBudget(existing.id);
      toast.success("Limite removido");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-lg">{categoryLabel}</DrawerTitle>
          {parentCategoryLabel && (
            <DrawerDescription>Subcategoria de {parentCategoryLabel}</DrawerDescription>
          )}
        </DrawerHeader>

        <div className="px-4 pb-2 space-y-5 overflow-y-auto">
          {/* Limite */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pocket-limit" className="text-xs uppercase tracking-wide text-muted-foreground">
                Limite mensal
              </Label>
              <Input
                id="pocket-limit"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="text-base h-11"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Avisar a partir de</span>
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

          {/* Últimas transações */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground">
              Últimos gastos no mês
            </h4>
            {recentTxs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                Nenhum gasto registrado nesta categoria neste mês.
              </p>
            ) : (
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card/30">
                {recentTxs.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{t.description}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {new Date(t.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        {t.account ? ` · ${t.account}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-destructive tabular-nums shrink-0">
                      −{formatBRL(t.value)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to={`/app/extrato?category=${encodeURIComponent(categoryLabel)}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={() => onOpenChange(false)}
            >
              Ver tudo no extrato <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <DrawerFooter className="flex-row gap-2">
          {existing && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={saving}
              aria-label="Remover limite"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {existing ? "Salvar" : "Definir limite"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
