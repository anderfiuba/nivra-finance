import { CheckCircle2, AlertTriangle, Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DisconnectButton } from "./DisconnectButton";
import type { PluggyItemSummary } from "@/contexts/FinanceContext";

const STATUS_OK = new Set(["UPDATED", "UPDATING", "PARTIAL_SUCCESS"]);
const STATUS_REAUTH = new Set(["LOGIN_ERROR", "WAITING_USER_INPUT", "USER_INPUT_TIMEOUT"]);

interface Props {
  item: PluggyItemSummary;
  onRemoved?: () => void;
}

export function ConnectionRow({ item, onRemoved }: Props) {
  const isOk = STATUS_OK.has(item.status ?? "");
  const isReauth = STATUS_REAUTH.has(item.status ?? "");
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
            {isOk && (
              <Badge
                variant="outline"
                className="border-success/40 text-success bg-success/10 px-1.5 py-0 text-[10px] h-5"
              >
                <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Atualizado
              </Badge>
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
