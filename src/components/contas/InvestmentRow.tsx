import { TrendingUp } from "lucide-react";
import { formatBRL } from "@/lib/format";
import type { FinanceInvestment } from "@/contexts/FinanceContext";

interface Props {
  investment: FinanceInvestment;
}

/**
 * Linha de uma posição de investimento dentro do AccountGroupCard "Investimentos".
 * Universal — aceita qualquer ativo retornado por /investments (CDB, Tesouro,
 * Fundos, Ações, ETFs, COE...).
 */
export function InvestmentRow({ investment }: Props) {
  const logoBg = investment.connectorPrimaryColor
    ? `#${investment.connectorPrimaryColor}`
    : undefined;

  const profit = investment.amountProfit;
  const profitPositive = typeof profit === "number" && profit > 0;
  const profitNegative = typeof profit === "number" && profit < 0;

  // Subtítulo: tipo + (issuer | conector).
  const subtitleParts: string[] = [];
  if (investment.subtype) subtitleParts.push(investment.subtype);
  else if (investment.type) subtitleParts.push(investment.type);
  if (investment.issuer) subtitleParts.push(investment.issuer);
  else if (investment.connectorName) subtitleParts.push(investment.connectorName);
  const subtitle = subtitleParts.join(" · ") || "Investimento";

  return (
    <div className="py-3 sm:py-3.5 px-1 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-secondary/60"
          style={logoBg ? { background: logoBg } : undefined}
        >
          {investment.connectorImageUrl ? (
            <img
              src={investment.connectorImageUrl}
              alt={investment.connectorName ?? investment.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{investment.name}</p>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          {investment.dueDate && (
            <p className="text-[11px] text-muted-foreground/80">
              Vence {new Date(investment.dueDate).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      </div>

      <div className="text-right shrink-0 sm:min-w-[180px] pl-13 sm:pl-0">
        <p className="text-sm font-bold text-foreground">{formatBRL(investment.balance)}</p>
        {typeof profit === "number" ? (
          <p
            className={`text-[11px] mt-0.5 tabular-nums ${
              profitPositive
                ? "text-success"
                : profitNegative
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
          >
            {profitPositive ? "+" : ""}
            {formatBRL(profit)} acumulado
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground mt-0.5">Saldo atual</p>
        )}
      </div>
    </div>
  );
}