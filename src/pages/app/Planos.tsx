import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2, ExternalLink } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { StripeCheckoutDialog } from "@/components/StripeCheckoutDialog";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "sonner";

type PlanDef = {
  id: "free" | "plus";
  name: string;
  price: string;
  period: string;
  features: string[];
  popular?: boolean;
};

const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    price: "R$ 0",
    period: "para sempre",
    features: [
      "1 conexão bancária pessoal",
      "Dashboard",
      "Extrato Unificado",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    price: "R$ 29,90",
    period: "por mês",
    popular: true,
    features: [
      "Conexões bancárias pessoais ilimitadas",
      "Dashboard",
      "Extrato Unificado",
      "Faturas",
      "Ciclo Financeiro",
      "Categorização",
    ],
  },
];

const Planos = () => {
  const { plan, isPlus, loading, refresh, subscription } = useSubscription();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Após retorno do checkout (return_url), revalida e limpa query.
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast.success("Pagamento confirmado! Atualizando seu plano…");
      refresh();
      const next = new URLSearchParams(searchParams);
      next.delete("checkout");
      next.delete("session_id");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, refresh, setSearchParams]);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/app/planos`,
        },
      });
      if (error || !data?.url) throw new Error(error?.message ?? "Falha ao abrir portal.");
      window.open(data.url, "_blank", "noopener");
    } catch (err) {
      toast.error("Não foi possível abrir o portal", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Planos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o plano que combina com você. Cancele quando quiser.
        </p>
      </div>

      {isPlus && subscription?.cancel_at_period_end && subscription.current_period_end && (
        <Card className="bg-warning/10 border-warning/40 p-4 text-sm text-foreground">
          Sua assinatura Plus está cancelada e permanece ativa até{" "}
          <strong>
            {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
          </strong>
          . Após essa data, sua conta volta ao plano Free.
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
        {PLANS.map((p) => {
          const current = plan === p.id;
          return (
          <Card
            key={p.id}
            className={`relative p-7 transition-smooth ${
              p.popular
                ? "bg-card border-primary/50 shadow-elegant"
                : "bg-gradient-card border-border hover:border-primary/30"
            }`}
          >
            {p.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-primary text-primary-foreground text-xs font-semibold">
                Mais popular
              </div>
            )}
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                {p.id === "plus" && <Crown className="h-4 w-4 text-primary" />}
                {p.name}
              </h3>
              {current && (
                <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10">Plano atual</Badge>
              )}
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">{p.price}</span>
              <span className="text-sm text-muted-foreground">{p.period}</span>
            </div>
            <ul className="mt-6 space-y-3">
              {p.features.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {renderCta({
              planId: p.id,
              current,
              loading,
              isPlus,
              portalLoading,
              onCheckout: () => setCheckoutOpen(true),
              onPortal: openPortal,
            })}
          </Card>
          );
        })}
      </div>

      <StripeCheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
};

function renderCta(args: {
  planId: "free" | "plus";
  current: boolean;
  loading: boolean;
  isPlus: boolean;
  portalLoading: boolean;
  onCheckout: () => void;
  onPortal: () => void;
}) {
  const { planId, current, loading, isPlus, portalLoading, onCheckout, onPortal } = args;
  if (loading) {
    return (
      <Button className="mt-7 w-full" variant="outline" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando…
      </Button>
    );
  }
  if (planId === "free") {
    return (
      <Button className="mt-7 w-full" variant="outline" disabled>
        {current ? "Plano atual" : "Plano gratuito"}
      </Button>
    );
  }
  // planId === "plus"
  if (current) {
    return (
      <Button
        className="mt-7 w-full"
        variant="outline"
        onClick={onPortal}
        disabled={portalLoading}
      >
        {portalLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <ExternalLink className="h-4 w-4 mr-2" />
        )}
        Gerenciar assinatura
      </Button>
    );
  }
  return (
    <Button
      className="mt-7 w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant"
      onClick={onCheckout}
      disabled={isPlus}
    >
      <Crown className="h-4 w-4 mr-2" /> Assinar Plus
    </Button>
  );
}

export default Planos;
