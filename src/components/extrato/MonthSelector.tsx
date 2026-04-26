import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SelectableBucket {
  key: string;
  label: string;
}

interface MonthSelectorProps {
  months: SelectableBucket[];
  value: string;
  onChange: (key: string) => void;
}

/**
 * Seletor de mês usado no Extrato. Mostra um <Select> com os últimos 12 meses
 * + chevrons para navegar para mês anterior/próximo dentro da lista.
 */
export function MonthSelector({ months, value, onChange }: MonthSelectorProps) {
  const idx = months.findIndex((m) => m.key === value);
  const canPrev = idx >= 0 && idx < months.length - 1;
  const canNext = idx > 0;

  const go = (delta: number) => {
    const next = idx + delta;
    if (next < 0 || next >= months.length) return;
    onChange(months[next].key);
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={!canPrev}
        onClick={() => go(1)}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 min-w-[140px] bg-input border-border capitalize">
          <SelectValue placeholder="Selecionar mês" />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {months.map((m) => (
            <SelectItem key={m.key} value={m.key} className="capitalize">
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={!canNext}
        onClick={() => go(-1)}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}