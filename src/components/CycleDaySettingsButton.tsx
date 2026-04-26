import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinance } from "@/contexts/FinanceContext";
import { toast } from "sonner";

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/**
 * Botão minimalista (ícone de engrenagem) que abre um diálogo para o usuário
 * redefinir o dia do ciclo financeiro. Mobile-friendly: o Dialog ocupa a tela
 * em telas pequenas e usa um Select nativo-like para escolher o dia.
 */
export function CycleDaySettingsButton({ className }: { className?: string }) {
  const { cycleDay, setCycleDay } = useFinance();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number>(cycleDay);

  // Sempre que abrir, sincroniza o draft com o valor atual.
  useEffect(() => {
    if (open) setDraft(cycleDay);
  }, [open, cycleDay]);

  const handleSave = () => {
    const safe = Math.max(1, Math.min(28, Math.floor(draft)));
    setCycleDay(safe);
    toast.success(`Ciclo financeiro definido para o dia ${safe}.`);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={className ?? "h-9 w-9 shrink-0"}
        onClick={() => setOpen(true)}
        aria-label="Configurar ciclo financeiro"
        title="Configurar ciclo financeiro"
      >
        <Settings2 className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ciclo financeiro</DialogTitle>
            <DialogDescription>
              Escolha o dia do mês em que seu ciclo começa. Usado para agrupar gastos por categoria
              e calcular o limite mensal.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <label className="text-sm font-medium text-foreground">Dia de fechamento do ciclo</label>
            <Select value={String(draft)} onValueChange={(v) => setDraft(Number(v))}>
              <SelectTrigger className="h-11 bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {DAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    Dia {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Ex.: dia 8 → o ciclo de abril vai de 09/mar a 08/abr.
            </p>
          </div>

          <DialogFooter className="flex-row gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" className="flex-1 sm:flex-none" onClick={handleSave}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}