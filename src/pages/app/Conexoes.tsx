import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Plus,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Loader2,
  Smartphone,
  Monitor,
  Plug,
  Clock,
} from "lucide-react";
import { useDeviceType } from "@/hooks/useDeviceType";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PluggyConnect } from "pluggy-connect-sdk";
import { useAuth } from "@/contexts/AuthContext";
import { formatRelativeTime } from "@/lib/format";
import { DisconnectButton } from "@/components/contas/DisconnectButton";
import {
  parsePluggyReturn,
  markConnectionStarted,
  consumeConnectionFlag,
} from "@/lib/pluggyReturnFlow";

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

export function buildPluggyRedirectUri(origin: string) {
  return `${origin}/app/conexoes`;
}

const Conexoes = () => {
  const device = useDeviceType();
  const { user } = useAuth();
  const [items, setItems] = useState<PluggyItemRow[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const returnHandledRef = useRef(false);

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

  // Reconcilia itens criados na Pluggy mas ausentes no nosso banco.
  // Usado como fallback quando o redirect OAuth do banco abre uma instância
  // nova da SPA e o callback in-memory `onSuccess` do PluggyConnect não roda.
  const reconcileMissingItems = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("pluggy-reconcile-items", {
        body: {},
      });
      if (error) throw error;
      const reconciled: string[] = Array.isArray(
        (data as { reconciled?: string[] })?.reconciled,
      )
        ? (data as { reconciled: string[] }).reconciled
        : [];
      if (reconciled.length > 0) {
        toast.success(
          reconciled.length === 1
            ? "Conta conectada! Sincronizando dados…"
            : `${reconciled.length} contas conectadas! Sincronizando dados…`,
        );
        await Promise.all(
          reconciled.map((itemId) =>
            supabase.functions.invoke("pluggy-sync-data", { body: { itemId } }),
          ),
        );
        await loadItems();
      }
    } catch (err) {
      // Reconcile é defensivo — falha silenciosa no console, sem toast ruidoso.
      console.warn("[conexoes] reconcile falhou", err);
    }
  }, [loadItems]);

  // Trata retorno do OAuth/Open Finance via query string (mobile).
  // Pluggy redireciona para /app/conexoes?item_id=... após autorização.
  useEffect(() => {
    if (!user) return;
    if (returnHandledRef.current) return;
    if (typeof window === "undefined") return;

    const parsed = parsePluggyReturn(window.location.search);
    const hadConnectingFlag = consumeConnectionFlag();

    if (parsed.itemId) {
      returnHandledRef.current = true;
      // Limpa a URL imediatamente para evitar reprocessamento em refresh.
      window.history.replaceState({}, "", window.location.pathname);
      registerItem(parsed.itemId);
      return;
    }

    if (parsed.error) {
      returnHandledRef.current = true;
      window.history.replaceState({}, "", window.location.pathname);
      toast.error("Conexão não concluída", { description: parsed.error });
      return;
    }

    // Sem item_id na URL, mas sabemos que o usuário acabou de iniciar uma
    // conexão nesta sessão → reconciliar contra a Pluggy.
    if (hadConnectingFlag) {
      returnHandledRef.current = true;
      reconcileMissingItems();
    }
  }, [user, registerItem, reconcileMissingItems]);

  const startConnection = async () => {
    if (!user) {
      toast.error("Faça login para conectar uma conta.");
      return;
    }
    setConnecting(true);
    try {
      const isMobile = device === "mobile";
      const { data, error } = await supabase.functions.invoke("pluggy-connect-token", {
        body: {
          ...(isMobile
            ? { openFinanceOnly: true, oauthRedirectUri: buildPluggyRedirectUri(window.location.origin) }
            : {}),
        },
      });
      if (error) throw error;
      const token = (data as { accessToken?: string })?.accessToken;
      const openFinanceConnectorIds = (data as { openFinanceConnectorIds?: number[] })?.openFinanceConnectorIds;
      if (!token) throw new Error("Token não retornado pela Pluggy.");

      if (isMobile && (!Array.isArray(openFinanceConnectorIds) || openFinanceConnectorIds.length === 0)) {
        throw new Error("Não foi possível carregar os bancos Open Finance disponíveis.");
      }

      // Em mobile, avisamos o usuário antes do redirecionamento ao banco para
      // que ele saiba onde irá inserir suas credenciais (Open Finance abre o
      // app/site oficial do banco — nunca pedimos senha dentro do Nivra).
      if (isMobile) {
        toast.info("Você será redirecionado ao seu banco para autorizar com segurança.");
      }

      // Abre o widget oficial Pluggy Connect.
      // - connectorTypes: limita à lista de bancos PF/PJ que suportamos.
      // - forceOauthInBrowser: em mobile, força o fluxo Open Finance a abrir
      //   no navegador do sistema (que dispara o app do banco via deep-link),
      //   em vez de cair no QR Code dentro do iframe do widget — que era o
      //   bug observado com Inter e Bradesco.
      // - language: PT-BR explícito para não cair em fallback de idioma.
      const pluggyConnect = new PluggyConnect({
        connectToken: token,
        includeSandbox: false,
        connectorTypes: ["PERSONAL_BANK", "BUSINESS_BANK"],
        ...(isMobile ? { connectorIds: openFinanceConnectorIds } : {}),
        language: "pt",
        ...(isMobile ? { forceOauthInBrowser: true } : {}),
        onSuccess: async (itemData: { item: { id: string } }) => {
          // Callback in-memory — só roda quando o widget volta na MESMA aba
          // (desktop/QR ou mobile sem redirect cross-context). Em mobile com
          // redirect OAuth real, o tratamento acontece via query string no
          // useEffect acima.
          sessionStorage.removeItem("pluggy:connecting");
          await registerItem(itemData.item.id);
        },
        onError: (err: { message?: string }) => {
          sessionStorage.removeItem("pluggy:connecting");
          toast.error("Conexão não concluída", {
            description: err?.message ?? "Tente novamente.",
          });
        },
        onClose: () => {
          setConnecting(false);
        },
      });
      // Marca que o usuário iniciou uma conexão. Se o redirect OAuth abrir
      // uma instância nova da SPA sem query param, o useEffect de retorno
      // detecta esta flag e dispara a reconciliação.
      markConnectionStarted();
      pluggyConnect.init();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao iniciar conexão.";
      toast.error("Não foi possível iniciar a conexão", { description: message });
      setConnecting(false);
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

      <Card className="bg-primary/5 border-primary/30 p-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Clock className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Sincronização automática</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            Atualizamos seus dados <strong>2 vezes ao dia</strong> — às <strong>00:00 e 12:00</strong> (horário de Brasília).
            Novas transações aparecem automaticamente em extrato, dashboard, categorias e faturas.
          </p>
        </div>
      </Card>

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
                    <Clock className="h-3 w-3" /> Última sincronização{" "}
                    {formatRelativeTime(it.last_synced_at ?? it.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <DisconnectButton
                    itemId={it.pluggy_item_id}
                    connectorName={it.connector_name}
                    variant="button"
                    onRemoved={loadItems}
                  />
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
