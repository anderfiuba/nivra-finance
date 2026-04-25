import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, CreditCard, X } from "lucide-react";
import { toast } from "sonner";
import { useFinance, type FinanceAccount } from "@/contexts/FinanceContext";

interface Props {
  /** Cartões pendentes de configuração de ciclo. */
  pendingAccounts: FinanceAccount[];
  /** Callback após salvar (para recalcular). */
  onSaved?: () => void;
  /** Esconder o card (dispensar). */
  onDismiss?: () => void;
}

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/**
 * Banner para o usuário informar dia de fechamento + dia de vencimento de cada
 * cartão cuja Pluggy não retornou esses campos automaticamente.
 */
export const ConfigCiclosCard = ({ pendingAccounts, onSaved, onDismiss }: Props) => {
  const { upsertCardCycle } = useFinance();
  const [closing, setClosing] = useState<Record<string, number | null>>({});
  const [due, setDue] = useState<Record<string, number | null>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  if (pendingAccounts.length === 0) return null;

  const handleSave = async (acc: FinanceAccount) => {
    const c = closing[acc.id] ?? null;
    const d = due[acc.id] ?? null;
    if (!c || !d) {
      toast.error("Informe o dia de fechamento e de vencimento.");
      return;
    }
    setSavingId(acc.id);
    await upsertCardCycle(acc.pluggyAccountId, c, d);
    setSavingId(null);
    toast.success("Ciclo configurado.");
    onSaved?.();
  };

  return (
    <Card className="bg-primary/5 border-primary/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            Informe os dias de fechamento e vencimento
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Para uma estimativa mais precisa, informe quando fecha e vence a fatura de cada cartão.
          </p>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={onDismiss}
            aria-label="Dispensar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {pendingAccounts.map((acc) => (
          <div
            key={acc.id}
            className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2 rounded-md border border-border/60 bg-background/40 p-3"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-foreground truncate">
                {acc.marketingName || acc.name}
                {acc.cardNumberLast4 ? ` •••• ${acc.cardNumberLast4}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Fechamento</span>
                <Select
                  value={closing[acc.id]?.toString() ?? ""}
                  onValueChange={(v) => setClosing((p) => ({ ...p, [acc.id]: Number(v) }))}
                >
                  <SelectTrigger className="h-8 w-[72px] bg-input border-border">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d} value={d.toString()}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Vencimento</span>
                <Select
                  value={due[acc.id]?.toString() ?? ""}
                  onValueChange={(v) => setDue((p) => ({ ...p, [acc.id]: Number(v) }))}
                >
                  <SelectTrigger className="h-8 w-[72px] bg-input border-border">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d} value={d.toString()}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="default"
                size="icon"
                className="h-8 w-8 bg-primary text-primary-foreground hover:opacity-90"
                onClick={() => handleSave(acc)}
                disabled={savingId === acc.id}
                aria-label="Confirmar"
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};