import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatBRL } from "@/lib/format";

interface Props {
  title: string;
  count: number;
  /** Cor da barrinha do TOTAL e do valor: vermelha (cartões) ou verde (contas). */
  totalTone?: "negative" | "positive" | "neutral";
  /** Valor exibido no rodapé. Se omitido, rodapé é escondido (ex: Conexões). */
  totalValue?: number;
  /** Mostrar valor com sinal negativo explícito (cartões). */
  totalSigned?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Card branco/secundário com header colapsável + corpo (lista de itens) +
 * rodapé "TOTAL" com barrinha lateral colorida. Inspirado no layout Pluggy.
 */
export function AccountGroupCard({
  title,
  count,
  totalTone = "neutral",
  totalValue,
  totalSigned = false,
  defaultOpen = true,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const toneBar =
    totalTone === "negative"
      ? "bg-destructive"
      : totalTone === "positive"
        ? "bg-success"
        : "bg-border";
  const toneValue =
    totalTone === "negative"
      ? "text-destructive"
      : totalTone === "positive"
        ? "text-success"
        : "text-foreground";

  const formattedTotal =
    totalValue !== undefined
      ? totalSigned && totalValue !== 0
        ? `-${formatBRL(Math.abs(totalValue))}`
        : formatBRL(Math.abs(totalValue))
      : null;

  return (
    <Card className="bg-gradient-card border-border overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
              <span className="text-xs text-muted-foreground shrink-0">{count}</span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 sm:px-5 pb-2 divide-y divide-border/60">{children}</div>

          {formattedTotal !== null && (
            <div className="border-t border-border/60 px-4 sm:px-5 py-3 flex items-center gap-3">
              <span className={`block w-1 h-5 rounded-sm ${toneBar}`} />
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Total
              </span>
              <span className={`ml-auto text-sm font-bold ${toneValue}`}>
                {formattedTotal}
              </span>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
