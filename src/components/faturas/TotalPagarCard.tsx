import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";

interface Props {
  total: number;
  installments: number;
  oneOff: number;
  message?: string | null;
}

/**
 * Card "Total a pagar" — agrega faturas fechadas + ciclos atuais estimados de
 * todos os cartões. Breakdown apenas Parcelas e Compras avulsas (sem
 * "Recorrentes" — ver decisão no plan.md).
 */
export const TotalPagarCard = ({ total, installments, oneOff, message }: Props) => {
  return (
    <Card className="bg-gradient-card border-border p-6 md:p-8">
      <p className="text-4xl md:text-5xl font-light text-foreground tabular-nums tracking-tight">
        {formatBRL(total)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Total a pagar</p>
      <div className="my-6 h-px bg-border" />
      <dl className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-muted-foreground">Parcelas</dt>
          <dd className="text-sm md:text-base font-semibold text-foreground tabular-nums">
            {formatBRL(installments)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-muted-foreground">Compras avulsas</dt>
          <dd className="text-sm md:text-base font-semibold text-foreground tabular-nums">
            {formatBRL(oneOff)}
          </dd>
        </div>
      </dl>
      {message && (
        <p className="mt-5 text-xs text-muted-foreground">{message}</p>
      )}
    </Card>
  );
};