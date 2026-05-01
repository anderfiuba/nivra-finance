import { AlertTriangle, CreditCard, Wallet } from "lucide-react";
import { formatBRL, formatRelativeTime } from "@/lib/format";
import type { FinanceAccount } from "@/contexts/FinanceContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  account: FinanceAccount;
  variant: "credit" | "bank";
  /**
   * Quando true: a conta está com saldo zerado mas tem movimento recente,
   * sinal típico de conector NÃO-Open Finance que não expõe saldo investido
   * (ex: Mercado Pago carteira com Rendimento à parte). Renderiza um aviso
   * sutil para deixar claro ao usuário que o valor exibido pode não ser o
   * total real disponível na instituição.
   */
  balanceLikelyIncomplete?: boolean;
  /**
   * Quando true: o item Pluggy desta conta retornou PARTIAL_SUCCESS — ou seja,
   * o banco entregou a conta mas o usuário não autorizou (ou a instituição
   * não entregou) algum produto, normalmente TRANSACTIONS. Renderiza aviso
   * claro no nome da conta.
   */
  partialSync?: boolean;
  /** Lista de produtos não entregues, derivada do statusDetail. */
  missingProducts?: string[];
}

/**
 * Linha de conta/cartão dentro de um AccountGroupCard.
 * - Mobile: stack vertical (logo+texto em cima, valor embaixo).
 * - Desktop: 3 colunas (logo, info, valor à direita).
 */
export function AccountRow({
  account,
  variant,
  balanceLikelyIncomplete,
  partialSync,
  missingProducts,
}: Props) {
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
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground truncate">
              {account.name}
            </p>
            {balanceLikelyIncomplete && (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center text-warning shrink-0" aria-label="Saldo possivelmente incompleto">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                    Esta instituição entregou saldo <strong>R$&nbsp;0</strong>, mas detectamos
                    movimento recente. Conectores que não usam Open Finance regulado
                    (ex: Mercado Pago) costumam não expor saldo investido. O valor real
                    disponível pode estar em uma carteira de rendimento não acessível
                    pela conexão.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {partialSync && (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center text-warning shrink-0"
                      aria-label="Conexão com sincronização parcial"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                    O banco autorizou apenas parte dos dados nesta conexão.
                    {missingProducts && missingProducts.length > 0 && (
                      <>
                        {" "}
                        Não foram entregues: <strong>{missingProducts.join(", ")}</strong>.
                      </>
                    )}{" "}
                    Reconecte em <strong>Conexões</strong> marcando todos os produtos no
                    consentimento para ver saldo, extrato e faturas completos.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
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
