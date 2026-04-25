import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Loader2,
  Smartphone,
  Monitor,
  Plug,
  Trash2,
} from "lucide-react";
import { useDeviceType } from "@/hooks/useDeviceType";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PluggyConnect } from "pluggy-connect-sdk";
import { useAuth } from "@/contexts/AuthContext";

// Linha de pluggy_items no Cloud + status atualizado.
interface PluggyItemRow {
  id: string;
  pluggy_item_id: string;
  connector_id: number | null;
  connector_name: string;
  connector_image_url: string | null;
  connector_primary_color: string | null;
  status: string | null;
  execution_status: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_OK = new Set(["UPDATED", "UPDATING", "PARTIAL_SUCCESS"]);
const STATUS_REAUTH = new Set(["LOGIN_ERROR", "WAITING_USER_INPUT", "USER_INPUT_TIMEOUT"]);

function formatRelative(iso?: string | null): string {
  if (!iso) return "nunca sincronizado";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

const Conexoes = () => {
  const device = useDeviceType();
  const { user } = useAuth();
  const [items, setItems] = useState<PluggyItemRow[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    setListError(null);
    try {
      const { data, error } = await supabase.functions.invoke("pluggy-list-items", {
        method: "GET",
      });
      if (error) throw error;
      const list: PluggyItemRow[] = Array.isArray((data as { items?: PluggyItemRow[] })?.items)
        ? (data as { items: PluggyItemRow[] }).items
        : [];
      setItems(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao carregar conexões.";
      setListError(message);
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }, [user]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Registra item no nosso banco após o Pluggy Connect retornar sucesso.
  const registerItem = useCallback(
    async (itemId: string) => {
      try {
        const { error } = await supabase.functions.invoke("pluggy-register-item", {
          body: { itemId },
        });
        if (error) throw error;
        toast.success("Conta conectada! Sincronizando dados…");
        // Dispara sync de accounts + transactions imediatamente
        const { error: syncErr } = await supabase.functions.invoke("pluggy-sync-data", {
          body: { itemId },
        });
        if (syncErr) {
          toast.error("Conta conectada, mas falha ao sincronizar dados.", {
            description: syncErr.message,
          });
        } else {
          toast.success("Dados sincronizados com sucesso!");
        }
        loadItems();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao registrar conexão.";
        toast.error("Erro ao registrar conta", { description: message });
      }
    },
    [loadItems],
  );

  const startConnection = async () => {
    if (!user) {
      toast.error("Faça login para conectar uma conta.");
      return;
    }
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("pluggy-connect-token", {
        body: {},
      });
      if (error) throw error;
      const token = (data as { accessToken?: string })?.accessToken;
      if (!token) throw new Error("Token não retornado pela Pluggy.");

      // Abre o widget oficial Pluggy Connect — funciona desktop e mobile.
      // No mobile o próprio widget faz o redirect para o app do banco.
      // No desktop ele renderiza o QR Code e fluxo seleção de banco.
      const pluggyConnect = new PluggyConnect({
        connectToken: token,
        includeSandbox: false,
        onSuccess: async (itemData: { item: { id: string } }) => {
          await registerItem(itemData.item.id);
        },
        onError: (err: { message?: string }) => {
          toast.error("Conexão não concluída", {
            description: err?.message ?? "Tente novamente.",
          });
        },
        onClose: () => {
          setConnecting(false);
        },
      });
      pluggyConnect.init();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao iniciar conexão.";
      toast.error("Não foi possível iniciar a conexão", { description: message });
      setConnecting(false);
    }
  };

  const handleSync = async (itemId: string, bank: string) => {
    setSyncingId(itemId);
    try {
      // 1. pede refresh na Pluggy
      await supabase.functions.invoke("pluggy-sync-item", { body: { itemId } });
      // 2. busca dados (accounts + transactions) e persiste
      const { error } = await supabase.functions.invoke("pluggy-sync-data", {
        body: { itemId },
      });
      if (error) throw error;
      toast.success(`Sincronização concluída — ${bank}`);
      loadItems();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao sincronizar.";
      toast.error("Erro ao sincronizar", { description: message });
    } finally {
      setSyncingId(null);
    }
  };

  const handleRemove = async (itemId: string, bank: string) => {
    setRemovingId(itemId);
    try {
      const { error } = await supabase.functions.invoke("pluggy-delete-item", {
        body: { itemId },
      });
      if (error) throw error;
      toast.success(`Conexão removida — ${bank}`, {
        description: "Contas, transações e faturas desse banco foram apagados.",
      });
      loadItems();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao remover conexão.";
      toast.error("Erro ao remover conexão", { description: message });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Conexões Open Finance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie integrações bancárias com total transparência e segurança.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadItems} disabled={loadingList}>
            {loadingList ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
          <Button
            onClick={startConnection}
            disabled={connecting}
            className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Nova conexão
          </Button>
        </div>
      </div>

      <Card className="bg-gradient-card border-border p-5 flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5 text-success" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Padrão regulado pelo Banco Central
          </h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Utilizamos Open Finance Brasil via Pluggy. Todos os dados trafegam criptografados e
            possuímos apenas permissão de leitura — jamais movimentamos valores em sua conta.
          </p>
        </div>
        <Lock className="h-4 w-4 text-success shrink-0" />
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {device === "desktop" ? (
          <>
            <Monitor className="h-3.5 w-3.5" />
            <span>
              Desktop detectado — novas conexões usarão <strong>QR Code</strong> via celular.
            </span>
          </>
        ) : (
          <>
            <Smartphone className="h-3.5 w-3.5" />
            <span>Celular detectado — você será redirecionado direto ao app do banco.</span>
          </>
        )}
      </div>

      {listError && (
        <Card className="bg-destructive/5 border-destructive/40 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">Erro ao carregar conexões</p>
            <p className="text-xs text-muted-foreground mt-1">{listError}</p>
          </div>
        </Card>
      )}

      {loadingList && !items && (
        <Card className="bg-gradient-card border-border p-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Carregando conexões…</span>
        </Card>
      )}

      {!loadingList && items && items.length === 0 && !listError && (
        <Card className="bg-gradient-card border-border p-10 flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-full bg-secondary/60 flex items-center justify-center mb-4">
            <Plug className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            Nenhuma conta conectada ainda
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Conecte sua primeira conta bancária via Open Finance para começar a visualizar saldos e
            transações em tempo real.
          </p>
          <Button onClick={startConnection} disabled={connecting} className="mt-5">
            {connecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Conectar primeira conta
          </Button>
        </Card>
      )}

      {items && items.length > 0 && (
        <div className="space-y-3">
          {items.map((it) => {
            const isOk = STATUS_OK.has(it.status);
            const isReauth = STATUS_REAUTH.has(it.status);
            const initials = it.connector_name.substring(0, 2).toUpperCase();
            return (
              <Card
                key={it.id}
                className="bg-gradient-card border-border p-5 flex items-center gap-4 flex-wrap"
              >
                <div
                  className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-secondary/60"
                  style={{ background: it.connector_primary_color ? `#${it.connector_primary_color}` : undefined }}
                >
                  {it.connector_image_url ? (
                    <img
                      src={it.connector_image_url}
                      alt={it.connector_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-semibold text-foreground text-sm">{initials}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-foreground">
                      {it.connector_name}
                    </h3>
                    {isOk && (
                      <Badge
                        variant="outline"
                        className="border-success/40 text-success bg-success/10"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                      </Badge>
                    )}
                    {isReauth && (
                      <Badge
                        variant="outline"
                        className="border-warning/40 text-warning bg-warning/10"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" /> Reautenticar
                      </Badge>
                    )}
                    {!isOk && !isReauth && (
                      <Badge variant="outline" className="border-border bg-secondary/50">
                        {it.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <RefreshCw className="h-3 w-3" /> Última sincronização{" "}
                    {formatRelative(it.last_synced_at ?? it.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(it.pluggy_item_id, it.connector_name)}
                    disabled={syncingId === it.pluggy_item_id}
                  >
                    {syncingId === it.pluggy_item_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Sincronizar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={removingId === it.pluggy_item_id}
                      >
                        {removingId === it.pluggy_item_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Remover
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover {it.connector_name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação revoga seu consentimento na Pluggy e apaga do painel
                          todas as contas, transações e faturas vinculadas a este banco.
                          Os limites de gastos por categoria que você definiu serão mantidos.
                          Para acessar novamente, será preciso conectar de novo.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleRemove(it.pluggy_item_id, it.connector_name)}
                        >
                          Remover conexão
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Conexoes;
