import { CreditCard, Wallet } from "lucide-react";
import { formatBRL, formatRelativeTime } from "@/lib/format";
import type { FinanceAccount } from "@/contexts/FinanceContext";

interface Props {
  account: FinanceAccount;
  variant: "credit" | "bank";
}

/**
 * Linha de conta/cartão dentro de um AccountGroupCard.
 * - Mobile: stack vertical (logo+texto em cima, valor embaixo).
 * - Desktop: 3 colunas (logo, info, valor à direita).
 */
export function AccountRow({ account, variant }: Props) {
  const isCredit = variant === "credit";
  const Icon = isCredit ? CreditCard : Wallet;

  const used = Math.abs(account.balance ?? 0);
  const limit = account.creditLimit ?? null;
  const pct = isCredit && limit && limit > 0 ? Math.min(100, (used / limit) * 100) : null;

  // Fundo do logo: cor primária do conector quando disponível.
  const logoBg = account.connectorPrimaryColor
    ? `#${account.connectorPrimaryColor}`
    : undefined;

  return (
    <div className="py-3 sm:py-3.5 px-1 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      {/* Logo + nome */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-secondary/60"
          style={logoBg ? { background: logoBg } : undefined}
        >
          {account.connectorImageUrl ? (
            <img
              src={account.connectorImageUrl}
              alt={account.connectorName ?? account.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Icon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">
            {account.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {account.connectorName ?? account.subtype ?? account.type ?? "Conta"}
          </p>
          {account.lastSyncedAt && (
            <p className="text-[11px] text-muted-foreground/80">
              {formatRelativeTime(account.lastSyncedAt)}
            </p>
          )}
        </div>
      </div>

      {/* Valor + métricas */}
      <div className="text-right shrink-0 sm:min-w-[180px] pl-13 sm:pl-0">
        <p
          className={`text-sm font-bold ${
            isCredit ? "text-destructive" : "text-foreground"
          }`}
        >
          {formatBRL(used)}
        </p>
        {isCredit && pct !== null ? (
          <>
            <div className="mt-1 h-1.5 w-full sm:w-40 ml-auto bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-destructive"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {pct.toFixed(1)}% · Limite: {formatBRL(limit!)}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground mt-0.5">Saldo atual</p>
        )}
      </div>
    </div>
  );
}
