import { CheckCircle2, AlertTriangle, Plug, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DisconnectButton } from "./DisconnectButton";
import type { PluggyItemSummary } from "@/contexts/FinanceContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STATUS_OK = new Set(["UPDATED", "UPDATING"]);
const STATUS_REAUTH = new Set(["LOGIN_ERROR", "WAITING_USER_INPUT", "USER_INPUT_TIMEOUT"]);

/**
 * Mapeia statusDetail.<produto>.warnings/errors em uma lista legível
 * dos produtos que NÃO foram sincronizados (ex.: o usuário só autorizou
 * dados cadastrais e contas, mas negou TRANSACTIONS no Inter/Bradesco).
 */
function listMissingProducts(detail: Record<string, unknown> | null): string[] {
  if (!detail || typeof detail !== "object") return [];
  const labels: Record<string, string> = {
    accounts: "Contas",
    transactions: "Transações",
    creditCards: "Cartões",
    investments: "Investimentos",
    loans: "Empréstimos",
    identity: "Dados cadastrais",
    paymentData: "Dados de pagamento",
    incomeReports: "Comprovantes de renda",
  };
  const missing: string[] = [];
  for (const [key, raw] of Object.entries(detail)) {
    if (!raw || typeof raw !== "object") continue;
    const v = raw as { isUpdated?: boolean; warnings?: unknown[]; errors?: unknown[] };
    const failed =
      v.isUpdated === false ||
      (Array.isArray(v.errors) && v.errors.length > 0) ||
      (Array.isArray(v.warnings) && v.warnings.length > 0);
    if (failed) missing.push(labels[key] ?? key);
  }
  return missing;
}

interface Props {
  item: PluggyItemSummary;
  onRemoved?: () => void;
}

export function ConnectionRow({ item, onRemoved }: Props) {
  const isOk = STATUS_OK.has(item.status ?? "");
  const isReauth = STATUS_REAUTH.has(item.status ?? "");
  const isPartial = (item.executionStatus ?? "") === "PARTIAL_SUCCESS";
  const missingProducts = isPartial ? listMissingProducts(item.statusDetail) : [];
  const logoBg = item.connectorPrimaryColor ? `#${item.connectorPrimaryColor}` : undefined;

  return (
    <div className="py-3 sm:py-3.5 px-1 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-secondary/60"
          style={logoBg ? { background: logoBg } : undefined}
        >
          {item.connectorImageUrl ? (
            <img
              src={item.connectorImageUrl}
              alt={item.connectorName}
              className="h-full w-full object-cover"
            />
          ) : (
            <Plug className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{item.connectorName}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {isOk && !isPartial && (
              <Badge
                variant="outline"
                className="border-success/40 text-success bg-success/10 px-1.5 py-0 text-[10px] h-5"
              >
                <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Atualizado
              </Badge>
            )}
            {isPartial && (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="border-warning/40 text-warning bg-warning/10 px-1.5 py-0 text-[10px] h-5 cursor-help"
                    >
                      <Info className="h-2.5 w-2.5 mr-1" /> Sincronização parcial
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                    O banco autorizou apenas parte dos dados nesta conexão.
                    {missingProducts.length > 0 && (
                      <>
                        {" "}
                        Não foram entregues: <strong>{missingProducts.join(", ")}</strong>.
                      </>
                    )}{" "}
                    Reconecte e marque todos os produtos no consentimento do banco
                    para ver saldos completos, extrato e faturas.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {isReauth && (
              <Badge
                variant="outline"
                className="border-warning/40 text-warning bg-warning/10 px-1.5 py-0 text-[10px] h-5"
              >
                <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Reautenticar
              </Badge>
            )}
            {!isOk && !isReauth && item.status && (
              <Badge variant="outline" className="border-border bg-secondary/50 px-1.5 py-0 text-[10px] h-5">
                {item.status}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {item.accountCount} {item.accountCount === 1 ? "conta" : "contas"}
            </span>
          </div>
        </div>
      </div>
      <div className="ml-auto sm:ml-0 shrink-0">
        <DisconnectButton
          itemId={item.pluggyItemId}
          connectorName={item.connectorName}
          variant="link"
          onRemoved={onRemoved}
        />
      </div>
    </div>
  );
}
