import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Loader2,
  QrCode,
  Smartphone,
  Monitor,
  Plug,
} from "lucide-react";
import { useDeviceType } from "@/hooks/useDeviceType";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

type ConnectFlow = {
  open: boolean;
  loading: boolean;
  accessToken: string | null;
  error: string | null;
};

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
  const [items, setItems] = useState<PluggyItemRow[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [flow, setFlow] = useState<ConnectFlow>({
    open: false,
    loading: false,
    accessToken: null,
    error: null,
  });

  // TODO: substituir por user.id quando habilitarmos auth no app.
  const CLIENT_USER_ID = "demo-user";

  const loadItems = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        `pluggy-list-items?clientUserId=${encodeURIComponent(CLIENT_USER_ID)}`,
        { method: "GET" },
      );
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
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Captura callback do Pluggy Connect.
  // Quando o usuário conclui, o widget redireciona para a mesma URL com
  // ?item_id=xxx (ou ?error=...). Detectamos e registramos no banco.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get("item_id");
    const errorMsg = params.get("error");
    if (errorMsg) {
      toast.error("Conexão não concluída", { description: errorMsg });
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState({}, "", url.toString());
      return;
    }
    if (itemId) {
      (async () => {
        try {
          const { error } = await supabase.functions.invoke("pluggy-register-item", {
            body: { itemId, clientUserId: CLIENT_USER_ID },
          });
          if (error) throw error;
          toast.success("Conta conectada com sucesso!");
          loadItems();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Falha ao registrar conexão.";
          toast.error("Erro ao registrar conta", { description: message });
        } finally {
          const url = new URL(window.location.href);
          url.search = "";
          window.history.replaceState({}, "", url.toString());
        }
      })();
    }
  }, [loadItems]);

  const startConnection = async () => {
    setFlow({ open: true, loading: true, accessToken: null, error: null });
    try {
      const { data, error } = await supabase.functions.invoke("pluggy-connect-token", {
        body: { clientUserId: CLIENT_USER_ID },
      });
      if (error) throw error;
      const token = (data as { accessToken?: string })?.accessToken;
      if (!token) throw new Error("Token não retornado pela Pluggy.");
      setFlow({ open: true, loading: false, accessToken: token, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao iniciar conexão.";
      setFlow({ open: true, loading: false, accessToken: null, error: message });
      toast.error("Não foi possível iniciar a conexão", { description: message });
    }
  };

  const closeFlow = () => {
    setFlow({ open: false, loading: false, accessToken: null, error: null });
    // Após fechar, recarrega lista — usuário pode ter completado conexão.
    loadItems();
  };

  const handleSync = async (itemId: string, bank: string) => {
    setSyncingId(itemId);
    try {
      const { error } = await supabase.functions.invoke("pluggy-sync-item", {
        body: { itemId },
      });
      if (error) throw error;
      toast.success(`Sincronização iniciada — ${bank}`);
      // dá um tempinho para Pluggy atualizar status
      setTimeout(loadItems, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao sincronizar.";
      toast.error("Erro ao sincronizar", { description: message });
    } finally {
      setSyncingId(null);
    }
  };

  const connectUrl = flow.accessToken
    ? `https://connect.pluggy.ai/?connect_token=${encodeURIComponent(flow.accessToken)}`
    : null;

  // No mobile redirecionamos direto.
  useEffect(() => {
    if (device === "mobile" && flow.open && connectUrl && !flow.loading && !flow.error) {
      window.location.href = connectUrl;
    }
  }, [device, flow.open, flow.loading, flow.error, connectUrl]);

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
            className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant"
          >
            <Plus className="h-4 w-4 mr-2" /> Nova conexão
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
          <Button onClick={startConnection} className="mt-5">
            <Plus className="h-4 w-4 mr-2" /> Conectar primeira conta
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    Remover
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={flow.open} onOpenChange={(open) => !open && closeFlow()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {device === "desktop" ? (
                <>
                  <QrCode className="h-5 w-5 text-primary" /> Conectar via QR Code
                </>
              ) : (
                <>
                  <Smartphone className="h-5 w-5 text-primary" /> Abrindo seu banco
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {device === "desktop"
                ? "Abra a câmera do celular e escaneie o QR Code abaixo. Você será levado ao app do seu banco para autorizar o compartilhamento."
                : "Você está sendo redirecionado para autenticação no banco selecionado…"}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 flex flex-col items-center gap-4">
            {flow.loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Gerando token seguro…
              </div>
            )}

            {flow.error && (
              <div className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> {flow.error}
              </div>
            )}

            {!flow.loading && !flow.error && connectUrl && device === "desktop" && (
              <>
                <div className="rounded-lg bg-white p-3 shadow-elegant">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(connectUrl)}`}
                    alt="QR Code para conectar conta bancária"
                    width={240}
                    height={240}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  O QR Code expira em alguns minutos. Não compartilhe com terceiros.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href={connectUrl} target="_blank" rel="noopener noreferrer">
                    Abrir nesta janela
                  </a>
                </Button>
              </>
            )}

            {!flow.loading && !flow.error && connectUrl && device === "mobile" && (
              <Button asChild className="w-full">
                <a href={connectUrl}>Continuar para o banco</a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Conexoes;
