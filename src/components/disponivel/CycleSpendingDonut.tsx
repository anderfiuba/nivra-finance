import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

interface Props {
  total: number;
  limit: number | null;
  slices: DonutSlice[];
}

const PALETTE = [
  "hsl(217 91% 60%)", // primary blue
  "hsl(142 71% 45%)", // green
  "hsl(173 58% 39%)", // teal
  "hsl(262 83% 58%)", // purple
  "hsl(38 92% 50%)", // amber
  "hsl(0 84% 60%)", // red
  "hsl(199 89% 48%)", // sky
  "hsl(280 65% 60%)", // violet
];

/**
 * Card "Visão geral dos gastos" — donut chart com legenda.
 * Mobile-first: empilha donut acima da legenda; em sm+ vira lado-a-lado.
 */
export function CycleSpendingDonut({ total, limit, slices }: Props) {
  // Top 6 + "Outros". Cores estáveis por índice.
  const top = useMemo(() => {
    const sorted = [...slices].sort((a, b) => b.value - a.value);
    const head = sorted.slice(0, 6);
    const tail = sorted.slice(6);
    const others = tail.reduce((s, x) => s + x.value, 0);
    const merged = others > 0 ? [...head, { name: "Outros", value: others, color: "hsl(220 10% 50%)" }] : head;
    return merged.map((s, i) => ({ ...s, color: s.color || PALETTE[i % PALETTE.length] }));
  }, [slices]);

  const hasLimit = typeof limit === "number" && limit > 0;
  const totalPct = hasLimit ? Math.round((total / (limit ?? 1)) * 100) : null;

  if (top.length === 0) {
    return (
      <Card className="bg-card shadow-none border-border p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Visão geral dos gastos</h3>
        <p className="text-xs text-muted-foreground">Sem gastos categorizados neste ciclo ainda.</p>
      </Card>
    );
  }

  return (
    <Card className="bg-card shadow-none border-border p-4 sm:p-5">
      <div className="flex items-center gap-1.5 mb-3">
        <h3 className="text-sm font-semibold text-foreground">Visão geral dos gastos</h3>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-xs">
              Distribuição dos seus gastos do ciclo por categoria. As 6 maiores
              aparecem nominalmente; o restante é agrupado em "Outros".
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4 sm:gap-6 items-center">
        {/* Donut */}
        <div className="relative w-full max-w-[200px] mx-auto sm:mx-0 aspect-square">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={top}
                cx="50%"
                cy="50%"
                innerRadius="62%"
                outerRadius="92%"
                dataKey="value"
                stroke="none"
                paddingAngle={1}
              >
                {top.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total gasto</span>
            <span className="text-base sm:text-lg font-bold text-foreground tabular-nums">{formatBRL(total)}</span>
            {totalPct !== null && (
              <span className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                {totalPct}% do limite
              </span>
            )}
          </div>
        </div>

        {/* Legenda */}
        <ul className="space-y-2 min-w-0">
          {top.map((s) => {
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
            return (
              <li key={s.name} className="flex items-center gap-2 text-xs min-w-0">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                <span className="text-foreground truncate flex-1">{s.name}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">{formatBRL(s.value)}</span>
                <span className={cn("text-muted-foreground tabular-nums shrink-0 text-[11px] w-9 text-right")}>
                  {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}