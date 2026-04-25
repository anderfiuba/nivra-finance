import { ArrowDownRight, ArrowUpRight, ArrowLeftRight, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MonthSummaryCardProps {
  count: number;
  entradas: number;
  saidas: number;
}

/**
 * Resumo do mês selecionado: nº de transações, entradas, saídas e resultado.
 * Layout compacto inspirado na referência: linha única em mobile, grid em desktop.
 */
export function MonthSummaryCard({ count, entradas, saidas }: MonthSummaryCardProps) {
  const resultado = entradas - saidas;
  const resultadoPositivo = resultado >= 0;

  return (
    <Card className="bg-gradient-card border-border p-3 md:p-4">
      {/* Mobile: linha compacta com ícones + valores */}
      <div className="flex items-center justify-between gap-2 md:hidden">
        <div className="flex items-center gap-1.5 text-foreground">
          <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{count}</span>
        </div>
        <div className="flex items-center gap-1 text-success">
          <ArrowDownRight className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">{formatBRL(entradas)}</span>
        </div>
        <div className="flex items-center gap-1 text-destructive">
          <ArrowUpRight className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">{formatBRL(saidas)}</span>
        </div>
        <div className={cn("flex items-center gap-1", resultadoPositivo ? "text-success" : "text-destructive")}>
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span className="text-xs font-bold">
            {resultadoPositivo ? "" : "−"}
            {formatBRL(Math.abs(resultado))}
          </span>
        </div>
      </div>

      {/* Desktop: grid de 4 mini-cards */}
      <div className="hidden md:grid md:grid-cols-4 md:gap-4">
        <SummaryItem
          icon={<Receipt className="h-4 w-4" />}
          label="Transações"
          value={String(count)}
          tone="muted"
        />
        <SummaryItem
          icon={<ArrowDownRight className="h-4 w-4" />}
          label="Entradas"
          value={formatBRL(entradas)}
          tone="success"
        />
        <SummaryItem
          icon={<ArrowUpRight className="h-4 w-4" />}
          label="Saídas"
          value={formatBRL(saidas)}
          tone="destructive"
        />
        <SummaryItem
          icon={<ArrowLeftRight className="h-4 w-4" />}
          label="Resultado do mês"
          value={`${resultadoPositivo ? "" : "−"}${formatBRL(Math.abs(resultado))}`}
          tone={resultadoPositivo ? "success" : "destructive"}
          highlight
        />
      </div>
    </Card>
  );
}

function SummaryItem({
  icon,
  label,
  value,
  tone,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "muted" | "success" | "destructive";
  highlight?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={toneClass}>{icon}</span>
        {label}
      </div>
      <div className={cn("font-semibold tabular-nums", highlight ? "text-lg" : "text-base", toneClass)}>
        {value}
      </div>
    </div>
  );
}