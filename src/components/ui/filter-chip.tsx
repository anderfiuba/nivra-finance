import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Texto principal mostrado no chip (ex: "Período", "Categorias"). */
  label: string;
  /** Quando true, indica que há um filtro ativo (mostra dot + texto em primary). */
  active?: boolean;
  /** Mostrar chevron (default true). */
  showChevron?: boolean;
}

/**
 * Chip ovalado estilo pill (referência: apps fintech BR como Banco Inter).
 * Usado em filtros (Período / Categorias / Tipos de transação) — ocupa
 * pouco espaço, é "tappable" em mobile e mantém consistência visual.
 */
export const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ label, active, showChevron = true, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs md:text-sm whitespace-nowrap",
          "bg-secondary/70 text-foreground border border-transparent",
          "hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:opacity-50 disabled:pointer-events-none",
          active && "bg-primary/10 text-primary border-primary/30",
          className,
        )}
        {...props}
      >
        <span className="truncate max-w-[180px]">{children ?? label}</span>
        {showChevron && <ChevronDown className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />}
      </button>
    );
  },
);
FilterChip.displayName = "FilterChip";
