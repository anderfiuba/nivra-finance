import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type MonthBucket, monthBucketFromKey } from "@/lib/months";
import type { DateRange } from "react-day-picker";

export type PeriodMode = "month" | "last3" | "all" | "custom";

export interface PeriodValue {
  mode: PeriodMode;
  /** Para mode="month": chave "YYYY-MM". */
  monthKey?: string;
  /** Para mode="custom": intervalo (inclusive). */
  range?: { from: Date; to: Date };
}

interface PeriodFilterProps {
  months: MonthBucket[];
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
}

const MODE_LABEL: Record<PeriodMode, string> = {
  month: "Mês específico",
  last3: "Últimos 3 meses",
  all: "Todo o período",
  custom: "Personalizado",
};

function formatShort(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatLong(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

/**
 * Filtro de período padrão bancário:
 *  - Mês específico (default)
 *  - Últimos 3 meses
 *  - Todo o período
 *  - Personalizado (intervalo de datas)
 *
 * Funciona como um único Popover compacto em mobile e como linha de controles em desktop.
 */
export function PeriodFilter({ months, value, onChange }: PeriodFilterProps) {
  const [open, setOpen] = useState(false);
  const [draftMode, setDraftMode] = useState<PeriodMode>(value.mode);
  const [draftMonth, setDraftMonth] = useState<string>(value.monthKey ?? months[0]?.key ?? "");
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(
    value.range ? { from: value.range.from, to: value.range.to } : undefined,
  );

  const summary = useMemo(() => buildSummary(value, months), [value, months]);

  const apply = () => {
    if (draftMode === "month") {
      onChange({ mode: "month", monthKey: draftMonth });
    } else if (draftMode === "custom") {
      if (draftRange?.from && draftRange?.to) {
        onChange({ mode: "custom", range: { from: draftRange.from, to: draftRange.to } });
      } else if (draftRange?.from) {
        // permite um único dia
        onChange({ mode: "custom", range: { from: draftRange.from, to: draftRange.from } });
      } else {
        return; // nada a aplicar
      }
    } else {
      onChange({ mode: draftMode });
    }
    setOpen(false);
  };

  const onOpenChange = (next: boolean) => {
    if (next) {
      // reset draft a partir do valor atual
      setDraftMode(value.mode);
      setDraftMonth(value.monthKey ?? months[0]?.key ?? "");
      setDraftRange(value.range ? { from: value.range.from, to: value.range.to } : undefined);
    }
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 px-3 bg-input border-border w-full sm:w-auto sm:max-w-sm justify-start"
          aria-label="Filtrar período"
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="flex flex-col items-start leading-tight min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground hidden sm:block">
              {MODE_LABEL[value.mode]}
            </span>
            <span className="text-sm font-medium truncate w-full text-left">
              {summary}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(92vw,360px)] p-0 pointer-events-auto"
        sideOffset={6}
      >
        {/* Modos */}
        <div className="p-3 border-b border-border">
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(MODE_LABEL) as PeriodMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDraftMode(m)}
                className={cn(
                  "h-8 rounded-md text-xs font-medium border transition-colors",
                  draftMode === m
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-accent",
                )}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo do modo selecionado */}
        <div className="p-3 min-h-[80px]">
          {draftMode === "month" && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Selecionar mês</label>
              <Select value={draftMonth} onValueChange={setDraftMonth}>
                <SelectTrigger className="h-9 bg-input border-border capitalize">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {months.map((m) => (
                    <SelectItem key={m.key} value={m.key} className="capitalize">
                      {m.longLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {draftMode === "last3" && (
            <p className="text-xs text-muted-foreground">
              Inclui o mês atual e os 2 anteriores ({months.slice(0, 3).map((m) => m.label).join(" · ")}).
            </p>
          )}

          {draftMode === "all" && (
            <p className="text-xs text-muted-foreground">
              Mostra todas as transações disponíveis (até 12 meses sincronizados).
            </p>
          )}

          {draftMode === "custom" && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Selecione o intervalo (data inicial e final)
              </label>
              <div className="rounded-md border border-border overflow-hidden">
                <Calendar
                  mode="range"
                  selected={draftRange}
                  onSelect={setDraftRange}
                  numberOfMonths={1}
                  defaultMonth={draftRange?.from ?? new Date()}
                  className={cn("p-2 pointer-events-auto")}
                />
              </div>
              {draftRange?.from && (
                <p className="text-xs text-muted-foreground">
                  {formatLong(draftRange.from)}
                  {draftRange.to ? ` — ${formatLong(draftRange.to)}` : " — selecione data final"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-2 p-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={apply}
            disabled={draftMode === "custom" && !draftRange?.from}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function buildSummary(v: PeriodValue, months: MonthBucket[]): string {
  if (v.mode === "all") return "Todo o período";
  if (v.mode === "last3") {
    const last3 = months.slice(0, 3);
    if (last3.length >= 3) {
      return `${last3[2].label} — ${last3[0].label}`;
    }
    return "Últimos 3 meses";
  }
  if (v.mode === "custom" && v.range) {
    const sameDay =
      v.range.from.toDateString() === v.range.to.toDateString();
    return sameDay
      ? formatLong(v.range.from)
      : `${formatShort(v.range.from)} — ${formatShort(v.range.to)}`;
  }
  // month
  const b = v.monthKey ? monthBucketFromKey(v.monthKey) : null;
  return b ? b.longLabel : "Selecionar mês";
}