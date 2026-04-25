import { useState } from "react";
import { Loader2, Plug2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  itemId: string;
  connectorName: string;
  /** Aparência: link enxuto (página Contas) ou botão completo (página Conexões). */
  variant?: "link" | "button";
  onRemoved?: () => void;
}

/**
 * Botão de desconectar reutilizável. Abre AlertDialog, chama a edge function
 * `pluggy-delete-item` (que apaga contas/transações/faturas vinculadas) e
 * dispara o callback de refresh.
 */
export function DisconnectButton({ itemId, connectorName, variant = "link", onRemoved }: Props) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const { error } = await supabase.functions.invoke("pluggy-delete-item", {
        body: { itemId },
      });
      if (error) throw error;
      toast.success(`Conexão removida — ${connectorName}`, {
        description: "Contas, transações e faturas desse banco foram apagados.",
      });
      onRemoved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao remover conexão.";
      toast.error("Erro ao remover conexão", { description: message });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {variant === "link" ? (
          <button
            type="button"
            disabled={removing}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80 disabled:opacity-50 transition-colors"
          >
            {removing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plug2 className="h-3.5 w-3.5" />
            )}
            Desconectar
          </button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={removing}
          >
            {removing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Plug2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            Remover
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover {connectorName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação revoga seu consentimento e apaga do painel todas as contas,
            transações e faturas vinculadas a este banco. Os limites de gastos por
            categoria que você definiu serão mantidos. Para acessar novamente,
            será preciso conectar de novo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleRemove}
          >
            Remover conexão
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
