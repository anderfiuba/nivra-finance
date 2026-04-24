import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { connections as mockConnections } from "@/data/mockData";
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

type ConnectFlow = {
  open: boolean;
  loading: boolean;
  accessToken: string | null;
  error: string | null;
};

const Conexoes = () => {
  const device = useDeviceType();
  const [flow, setFlow] = useState<ConnectFlow>({
    open: false,
    loading: false,
    accessToken: null,
    error: null,
  });
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // No futuro substituiremos por dados reais da Pluggy via /pluggy-list-items.
  const connections = mockConnections;

  const startConnection = async () => {
    setFlow({ open: true, loading: true, accessToken: null, error: null });
    try {
      const { data, error } = await supabase.functions.invoke("pluggy-connect-token", {
        body: {},
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

  const closeFlow = () => setFlow({ open: false, loading: false, accessToken: null, error: null });

  const handleSync = async (itemId: string, bank: string) => {
    setSyncingId(itemId);
    try {
      const { error } = await supabase.functions.invoke("pluggy-sync-item", {
        body: { itemId },
      });
      if (error) throw error;
      toast.success(`Sincronização iniciada — ${bank}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao sincronizar.";
      toast.error("Erro ao sincronizar", { description: message });
    } finally {
      setSyncingId(null);
    }
  };

  // URL pública do Pluggy Connect — funciona tanto para QR quanto para redirect.
  const connectUrl = flow.accessToken
    ? `https://connect.pluggy.ai/?connect_token=${encodeURIComponent(flow.accessToken)}`
    : null;

  // No mobile: redirecionamos diretamente quando o token chega.
  useEffect(() => {
    if (device === "mobile" && flow.open && connectUrl && !flow.loading && !flow.error) {
      window.location.href = connectUrl;
    }
  }, [device, flow.open, flow.loading, flow.error, connectUrl]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Conexões Open Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie integrações bancárias com total transparência e segurança.</p>
        </div>
        <Button
          onClick={startConnection}
          className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant"
        >
          <Plus className="h-4 w-4 mr-2" /> Nova conexão
        </Button>
      </div>

      <Card className="bg-gradient-card border-border p-5 flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5 text-success" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Padrão regulado pelo Banco Central</h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            O Nivra utiliza o padrão Open Finance Brasil. Todos os dados trafegam de forma criptografada e a Nivra possui apenas permissão de leitura — jamais movimenta valores em sua conta.
          </p>
        </div>
        <Lock className="h-4 w-4 text-success shrink-0" />
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {device === "desktop" ? (
          <>
            <Monitor className="h-3.5 w-3.5" />
            <span>Desktop detectado — novas conexões usarão <strong>QR Code</strong> via celular.</span>
          </>
        ) : (
          <>
            <Smartphone className="h-3.5 w-3.5" />
            <span>Celular detectado — você será redirecionado direto ao app do banco.</span>
          </>
        )}
      </div>

      <div className="space-y-3">
        {connections.map((c) => (
          <Card key={c.id} className="bg-gradient-card border-border p-5 flex items-center gap-4 flex-wrap">
            <div className="h-11 w-11 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
              <span className="font-semibold text-foreground text-sm">{c.bank.substring(0, 2).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-foreground">{c.bank}</h3>
                {c.status === "conectado" ? (
                  <Badge variant="outline" className="border-success/40 text-success bg-success/10">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Reautenticar
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3" /> Última sincronização {c.lastSync}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {c.scopes.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs h-5 border-border bg-secondary/50">{s}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSync(c.id, c.bank)}
                disabled={syncingId === c.id}
              >
                {syncingId === c.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Sincronizar
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Remover</Button>
            </div>
          </Card>
        ))}
      </div>

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
