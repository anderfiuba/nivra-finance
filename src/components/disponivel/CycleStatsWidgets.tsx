import { Calendar, TrendingUp, Wallet, PiggyBank } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  /** Limite total do ciclo (null se não definido). */
  limit: number | null;
  /** Gasto acumulado no ciclo. */
  spent: number;
  /** Dias restantes até o fim do ciclo (mínimo 0). */
  daysRemaining: number;
  /** Data final do ciclo formatada (ex: "30/Abr"). */
  cycleEndLabel: string;
  onDefineLimit?: () => void;
}

/**
 * 4 widgets do topo do Ciclo Financeiro:
 *   1. Limite do ciclo (definido pelo usuário)
 *   2. Gasto atual (% do limite)
 *   3. Disponível (limite - gasto, % do limite)
 *   4. Dias restantes
 *
 * Layout:
 * - Mobile: 2 colunas
 * - sm+: 4 colunas
 * Sempre responsivo, sem scroll horizontal.
 */
export function CycleStatsWidgets({ limit, spent, daysRemaining, cycleEndLabel, onDefineLimit }: Props) {
  const hasLimit = typeof limit === "number" && limit > 0;
  const ratioSpent = hasLimit ? Math.min(1, spent / (limit ?? 1)) : 0;
  const remaining = hasLimit ? Math.max(0, (limit ?? 0) - spent) : 0;
  const ratioRemaining = hasLimit ? remaining / (limit ?? 1) : 0;

  const spentPct = hasLimit ? Math.round(ratioSpent * 100) : null;
  const remainingPct = hasLimit ? Math.round(ratioRemaining * 100) : null;

  const spentTone =
    !hasLimit
      ? "primary"
      : ratioSpent >= 1
        ? "destructive"
        : ratioSpent >= 0.8
          ? "warning"
          : "success";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Limite do ciclo */}
      <StatCard
        icon={<Wallet className="h-4 w-4" />}
        iconBg="bg-primary/10 text-primary"
        label="Limite do ciclo"
        value={hasLimit ? formatBRL(limit) : "Definir"}
        subtitle={hasLimit ? "Total definido" : "Sem limite"}
        barValue={100}
        barClass="[&>div]:bg-primary"
        onClick={!hasLimit ? onDefineLimit : undefined}
      />

      {/* 2. Gasto atual */}
      <StatCard
        icon={<TrendingUp className="h-4 w-4" />}
        iconBg="bg-success/10 text-success"
        label="Gasto atual"
        value={formatBRL(spent)}
        subtitle={spentPct !== null ? `${spentPct}% do limite` : "Sem limite definido"}
        barValue={spentPct ?? 0}
        barClass={cn(
          spentTone === "destructive" && "[&>div]:bg-destructive",
          spentTone === "warning" && "[&>div]:bg-warning",
          spentTone === "success" && "[&>div]:bg-success",
          spentTone === "primary" && "[&>div]:bg-primary",
        )}
      />

      {/* 3. Disponível */}
      <StatCard
        icon={<PiggyBank className="h-4 w-4" />}
        iconBg="bg-warning/10 text-warning"
        label="Disponível"
        value={hasLimit ? formatBRL(remaining) : "—"}
        subtitle={remainingPct !== null ? `${remainingPct}% do limite` : "Defina um limite"}
        barValue={remainingPct ?? 0}
        barClass="[&>div]:bg-warning"
      />

      {/* 4. Dias restantes */}
      <StatCard
        icon={<Calendar className="h-4 w-4" />}
        iconBg="bg-accent/40 text-foreground"
        label="Dias restantes"
        value={`${daysRemaining} ${daysRemaining === 1 ? "dia" : "dias"}`}
        subtitle={`Termina em ${cycleEndLabel}`}
        barValue={100}
        barClass="[&>div]:bg-primary/70"
      />
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  subtitle: string;
  barValue: number;
  barClass: string;
  onClick?: () => void;
}

function StatCard({ icon, iconBg, label, value, subtitle, barValue, barClass, onClick }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center gap-2">
          <span className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0", iconBg)}>
            {icon}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </span>
        </div>
        <p className="text-lg sm:text-xl font-bold text-foreground tabular-nums truncate">{value}</p>
        <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
        <Progress value={barValue} className={cn("h-1", barClass)} />
    </>
  );

  const baseClass = cn(
    "bg-card shadow-none border-border p-3 sm:p-4 flex flex-col gap-2 transition-smooth rounded-xl border",
    onClick && "cursor-pointer hover:bg-card/70 text-left",
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClass}>
        {content}
      </button>
    );
  }
  return <Card className={baseClass}>{content}</Card>;
}