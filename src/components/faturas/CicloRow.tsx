import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowDownRight, ChevronRight, CreditCard, Info, RefreshCcw } from "lucide-react";
import { formatBRL } from "@/lib/format";
import type { FinanceAccount } from "@/contexts/FinanceContext";
import type { Transaction } from "@/data/mockData";

export type CicloStatus = "fechada" | "atual" | "proxima" | "paga" | "vencida";

interface Props {
  account: FinanceAccount;
  status: CicloStatus;
  amount: number | null;
  /** "01/03 - 29/03" — janela do ciclo (opcional para "paga" compacta). */
  cycleLabel?: string | null;
  /** "08/04". */
  dueLabel?: string | null;
  /** "29/03" — fim do período de transações. */
  startLabel?: string | null;
  /** "08/04" — vencimento (timeline direita). */
  endLabel?: string | null;
  minimumPayment?: number | null;
  installmentCount: number;
  oneOffCount: number;
  /** Mostrar disclaimer "Baseado nas transações do ciclo atual". */
  showEstimateNotice?: boolean;
  /** Texto extra de prazo: "Vence em 13 dias". */
  dueStatusText?: string | null;
  /** Cor desse texto. */
  dueStatusTone?: "muted" | "warning" | "danger";
  /** Transações do ciclo para o expand. */
  transactions?: Transaction[];
  /** Versão compacta (Recentemente Pagas). */
  compact?: boolean;
}

const installmentRegex = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/;

function isInstallment(t: Transaction): boolean {
  if (t.installmentNumber !== null && t.totalInstallments !== null && t.totalInstallments > 1) {
    return true;
  }
  return installmentRegex.test(t.description);
}

function statusBadge(status: CicloStatus) {
  switch (status) {
    case "fechada":
      return { label: "Fechada", classes: "border-border bg-secondary/60 text-muted-foreground" };
    case "atual":
      return { label: "Ciclo atual", classes: "border-success/40 bg-success/10 text-success" };
    case "proxima":
      return { label: "Próxima", classes: "border-primary/30 bg-primary/10 text-primary" };
    case "paga":
      return { label: "Paga", classes: "border-success/40 bg-success/10 text-success" };
    case "vencida":
      return { label: "Vencida", classes: "border-destructive/40 bg-destructive/10 text-destructive" };
  }
}

export const CicloRow = ({
  account,
  status,
  amount,
  cycleLabel,
  dueLabel,
  startLabel,
  endLabel,
  minimumPayment,
  installmentCount,
  oneOffCount,
  showEstimateNotice,
  dueStatusText,
  dueStatusTone = "muted",
  transactions = [],
  compact = false,
}: Props) => {
  const [open, setOpen] = useState(false);
  const badge = statusBadge(status);
  const last4 = account.cardNumberLast4 ? ` •••• ${account.cardNumberLast4}` : "";
  const cardName = account.marketingName || account.name;

  const dueColor =
    dueStatusTone === "danger"
      ? "text-destructive"
      : dueStatusTone === "warning"
        ? "text-warning"
        : "text-muted-foreground";

  const installments = transactions.filter(isInstallment);
  const oneOffs = transactions.filter((t) => !isInstallment(t));

  return (
    <div className="p-4 md:p-5">
      {/* Cabeçalho: logo + nome + badge + valor */}
      <div className="flex items-start gap-3">
        <div
          className="h-9 w-9 rounded-lg overflow-hidden flex items-center justify-center shrink-0 bg-secondary"
          style={
            account.connectorPrimaryColor
              ? { backgroundColor: `#${account.connectorPrimaryColor}` }
              : undefined
          }
        >
          {account.connectorImageUrl ? (
            <img
              src={account.connectorImageUrl}
              alt={account.connectorName ?? "Banco"}
              className="h-9 w-9 object-contain"
            />
          ) : (
            <CreditCard className="h-4 w-4 text-foreground/70" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm md:text-base font-semibold text-foreground truncate">
              {cardName}
              <span className="text-muted-foreground font-normal">{last4}</span>
            </p>
            <Badge variant="outline" className={`text-[10px] h-5 ${badge.classes}`}>
              {badge.label}
            </Badge>
          </div>
        </div>
        <p
          className={`text-base md:text-lg font-semibold tabular-nums shrink-0 ${
            status === "paga" ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {amount !== null ? formatBRL(amount) : "—"}
        </p>
      </div>

      {compact ? null : (
        <>
          {/* Linha 2: ciclo / vencimento / mínimo · contadores */}
          <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-3 pl-12">
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {cycleLabel && <span>Ciclo: {cycleLabel}</span>}
              {dueLabel && (
                <>
                  <span className="hidden md:inline">·</span>
                  <span>Venc: {dueLabel}</span>
                </>
              )}
              {minimumPayment !== null && minimumPayment !== undefined && (
                <>
                  <span className="hidden md:inline">·</span>
                  <span>Pgto mín: {formatBRL(minimumPayment)}</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {installmentCount} {installmentCount === 1 ? "parcela" : "parcelas"} · {oneOffCount}{" "}
              {oneOffCount === 1 ? "compra" : "compras"}
            </p>
          </div>

          {/* Aviso de estimativa */}
          {showEstimateNotice && (
            <p className="mt-2 pl-12 text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                Baseado nas transações do ciclo atual. O valor oficial aparece quando o banco enviar
                a fatura.
              </span>
            </p>
          )}

          {dueStatusText && (
            <p className={`mt-1 pl-12 text-xs ${dueColor}`}>{dueStatusText}</p>
          )}

          {/* Timeline simples */}
          {(startLabel || endLabel) && (
            <div className="mt-3 pl-12 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>{startLabel ?? ""}</span>
              <div className="flex-1 h-px bg-border mx-3" />
              <span>{endLabel ?? ""}</span>
            </div>
          )}

          {/* Expand: ver transações */}
          {transactions.length > 0 && (
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleTrigger asChild>
                <button className="mt-3 pl-12 flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Ver transações
                  <ChevronRight
                    className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 ml-12 border-l border-border pl-4 space-y-3">
                  {oneOffs.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                        Compras avulsas
                      </p>
                      <div className="divide-y divide-border">
                        {oneOffs.map((t) => (
                          <TxLine key={t.id} t={t} icon="one-off" />
                        ))}
                      </div>
                    </div>
                  )}
                  {installments.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                        Parcelas
                      </p>
                      <div className="divide-y divide-border">
                        {installments.map((t) => (
                          <TxLine key={t.id} t={t} icon="installment" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
    </div>
  );
};

function TxLine({ t, icon }: { t: Transaction; icon: "one-off" | "installment" }) {
  const isExpense = t.type === "saida";
  const installLabel =
    t.installmentNumber && t.totalInstallments
      ? `${t.installmentNumber}/${t.totalInstallments}`
      : (t.description.match(installmentRegex)?.[0] ?? null);
  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
          icon === "installment"
            ? "bg-primary/10 text-primary"
            : "bg-destructive/10 text-destructive"
        }`}
      >
        {icon === "installment" ? (
          <RefreshCcw className="h-3.5 w-3.5" />
        ) : (
          <ArrowDownRight className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{t.description}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {t.category || "Sem categoria"}
          {installLabel ? ` · ${installLabel}` : ""}
        </p>
      </div>
      <p
        className={`text-xs font-semibold shrink-0 tabular-nums ${
          isExpense ? "text-destructive" : "text-success"
        }`}
      >
        {isExpense ? "−" : "+"}
        {formatBRL(Math.abs(t.value))}
      </p>
    </div>
  );
}