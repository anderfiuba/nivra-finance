import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSubscription } from "@/hooks/useSubscription";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "R$ 0",
    period: "para sempre",
    features: [
      "1 conexão bancária",
      "Dashboard",
      "Extrato unificado",
    ],
  },
  {
    id: "plus" as const,
    name: "Plus",
    price: "R$ 39,90",
    period: "por mês",
    popular: true,
    features: [
      "Conexões bancárias ilimitadas",
      "Dashboard",
      "Extrato unificado",
      "Faturas",
      "Ciclo Financeiro",
      "Categorização",
    ],
  },
];

const Planos = () => {
  const { plan, isPlus, cancelAtPeriodEnd, currentPeriodEnd, loading } = useSubscription();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/app/planos`,
        },
      });
      if (error || !data?.url) throw new Error(error?.message || data?.error || "Falha ao abrir portal.");
      window.open(data.url as string, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error("Não foi possível abrir o portal de cobrança", {
        description: e instanceof Error ? e.message : undefined,
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
          Escolha o plano ideal para o seu uso. Cancele quando quiser.
        </p>
      </div>

      {isPlus && cancelAtPeriodEnd && currentPeriodEnd && (
        <Card className="p-4 bg-orange-50 border-orange-200 text-sm text-orange-900">
          Sua assinatura Plus foi cancelada e permanece ativa até{" "}
          {new Date(currentPeriodEnd).toLocaleDateString("pt-BR")}.
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {PLANS.map((p) => {
          const current = !loading && plan === p.id;
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
                {p.id === "plus" && <Crown className="h-4 w-4 text-accent" />}
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
            {p.id === "free" ? (
              <Button className="mt-7 w-full" variant="outline" disabled>
                {current ? "Plano atual" : "Plano gratuito"}
              </Button>
            ) : current ? (
              <Button
                className="mt-7 w-full"
                variant="outline"
                onClick={openPortal}
                disabled={portalLoading}
              >
                {portalLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Gerenciar assinatura
              </Button>
            ) : (
              <Button
                className="mt-7 w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant"
                onClick={() => setCheckoutOpen(true)}
                disabled={loading}
              >
                Assinar Plus
              </Button>
            )}
          </Card>
          );
        })}
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Assinar Nivra Plus</DialogTitle>
          </DialogHeader>
          <div className="px-2 pb-4">
            {checkoutOpen && (
              <StripeEmbeddedCheckout
                priceId="plus_monthly"
                returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Planos;
