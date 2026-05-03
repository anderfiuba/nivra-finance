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
    <Card className="bg-gradient-card border-border p-3 md:p-4 overflow-hidden">
      {/* Mobile: grid 2x2 para evitar overflow com valores grandes */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:hidden">
        <MobileItem
          icon={<Receipt className="h-3.5 w-3.5" />}
          label="Transações"
          value={String(count)}
          tone="muted"
        />
        <MobileItem
          icon={<ArrowDownRight className="h-3.5 w-3.5" />}
          label="Entradas"
          value={formatBRL(entradas)}
          tone="success"
        />
        <MobileItem
          icon={<ArrowUpRight className="h-3.5 w-3.5" />}
          label="Saídas"
          value={formatBRL(saidas)}
          tone="destructive"
        />
        <MobileItem
          icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
          label="Resultado"
          value={`${resultadoPositivo ? "" : "−"}${formatBRL(Math.abs(resultado))}`}
          tone={resultadoPositivo ? "success" : "destructive"}
        />
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

function MobileItem({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "muted" | "success" | "destructive";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className={toneClass}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className={cn("text-sm font-semibold tabular-nums truncate", toneClass)}>{value}</div>
    </div>
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