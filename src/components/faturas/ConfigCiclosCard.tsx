import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, CreditCard, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useFinance, type FinanceAccount, type FinanceBill } from "@/contexts/FinanceContext";
import { inferClosingDayFromBills } from "@/lib/billPayment";

interface Props {
  /**
   * Cartões a exibir. Quando `mode = "pending"`, são apenas os sem
   * configuração resolvida; quando `mode = "edit"`, mostra todos para o
   * usuário ajustar valores existentes.
   */
  pendingAccounts: FinanceAccount[];
  /** Callback após salvar (para recalcular). */
  onSaved?: () => void;
  /** Esconder o card (dispensar). */
  onDismiss?: () => void;
  /**
   * "pending" (default): banner curto chamando para preencher.
   * "edit": modo de ajuste com valores atuais pré-carregados.
   */
  mode?: "pending" | "edit";
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * Banner para o usuário informar dia de fechamento + dia de vencimento de cada
 * cartão cuja Pluggy não retornou esses campos automaticamente.
 */
export const ConfigCiclosCard = ({ pendingAccounts, onSaved, onDismiss, mode = "pending" }: Props) => {
  const { upsertCardCycle, bills, cardCycleSettings } = useFinance();
  const [closing, setClosing] = useState<Record<string, number | null>>({});
  const [due, setDue] = useState<Record<string, number | null>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Pré-carrega valores: configurados (modo edit) ou inferidos das bills (modo pending).
  useEffect(() => {
    setClosing((prev) => {
      const next = { ...prev };
      for (const acc of pendingAccounts) {
        if (next[acc.id] != null) continue;
        const cur = cardCycleSettings[acc.pluggyAccountId];
        if (cur?.closingDay) {
          next[acc.id] = cur.closingDay;
          continue;
        }
        const accBills = bills.filter((b) => b.pluggyAccountId === acc.pluggyAccountId);
        const inferred = inferClosingDayFromBills(accBills);
        if (inferred) next[acc.id] = inferred.closingDay;
      }
      return next;
    });
    setDue((prev) => {
      const next = { ...prev };
      for (const acc of pendingAccounts) {
        if (next[acc.id] != null) continue;
        const cur = cardCycleSettings[acc.pluggyAccountId];
        if (cur?.dueDay) {
          next[acc.id] = cur.dueDay;
          continue;
        }
        const accBills = bills.filter((b) => b.pluggyAccountId === acc.pluggyAccountId);
        const inferred = inferClosingDayFromBills(accBills);
        if (inferred) next[acc.id] = inferred.dueDay;
      }
      return next;
    });
  }, [pendingAccounts, bills, cardCycleSettings]);

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

  const isEdit = mode === "edit";

  return (
    <Card className="bg-primary/5 border-primary/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            {isEdit ? "Ajustar fechamento e vencimento" : "Informe os dias de fechamento e vencimento"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isEdit
              ? "Confira os valores; alterar aqui recalcula o ciclo atual e o total a pagar."
              : "Para uma estimativa mais precisa, informe quando fecha e vence a fatura de cada cartão."}
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
        {pendingAccounts.map((acc) => {
          const accBills = bills.filter((b) => b.pluggyAccountId === acc.pluggyAccountId);
          const inferred = inferClosingDayFromBills(accBills);
          const cur = cardCycleSettings[acc.pluggyAccountId];
          const showSuggestion =
            inferred &&
            (cur?.closingDay !== inferred.closingDay || cur?.dueDay !== inferred.dueDay);
          return (
          <div
            key={acc.id}
            className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2 rounded-md border border-border/60 bg-background/40 p-3"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <span className="block text-sm font-medium text-foreground truncate">
                  {acc.marketingName || acc.name}
                  {acc.cardNumberLast4 ? ` •••• ${acc.cardNumberLast4}` : ""}
                </span>
                {showSuggestion && (
                  <button
                    type="button"
                    onClick={() => {
                      setClosing((p) => ({ ...p, [acc.id]: inferred.closingDay }));
                      setDue((p) => ({ ...p, [acc.id]: inferred.dueDay }));
                    }}
                    className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <Sparkles className="h-3 w-3" />
                    Sugerido pelas faturas: fecha {inferred.closingDay}, vence {inferred.dueDay}
                  </button>
                )}
              </div>
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
          );
        })}
      </div>
    </Card>
  );
};