import type { ReactNode } from "react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Check, Loader2 } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { StripeCheckoutDialog } from "@/components/StripeCheckoutDialog";

type Feature = "faturas" | "categorizacao";

const COPY: Record<Feature, { title: string; subtitle: string; bullets: string[] }> = {
  faturas: {
    title: "Faturas faz parte do plano Plus",
    subtitle: "Acompanhe os cartões de crédito conectados em um só lugar.",
    bullets: [
      "Visualize e acompanhe faturas de cartão",
      "Entenda vencimentos, valores e pagamentos",
      "Tenha mais controle sobre os gastos no cartão",
    ],
  },
  categorizacao: {
    title: "Ciclo Financeiro faz parte do plano Plus",
    subtitle: "Organize categorias e tenha leituras mais precisas do seu dinheiro.",
    bullets: [
      "Organize e corrija categorias das transações",
      "Melhore a leitura financeira do extrato",
      "Gere análises e resumos mais precisos",
    ],
  },
};

export function PlanGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { isPlus, loading } = useSubscription();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  if (loading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isPlus) return <>{children}</>;

  const copy = COPY[feature];
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <Card className="bg-gradient-card border-border p-8 md:p-10">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-primary/15 flex items-center justify-center">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">{copy.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{copy.subtitle}</p>
          </div>
        </div>

        <ul className="mt-6 space-y-3">
          {copy.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm text-foreground">
              <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">R$ 29,90</span>
          <span className="text-sm text-muted-foreground">/mês — cancele quando quiser</span>
        </div>

        <div className="mt-6 flex gap-3 flex-wrap">
          <Button
            onClick={() => setCheckoutOpen(true)}
            className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant"
          >
            <Crown className="h-4 w-4 mr-2" /> Assinar Plus
          </Button>
          <Button variant="outline" asChild>
            <a href="/app/planos">Ver detalhes do plano</a>
          </Button>
        </div>
      </Card>

      <StripeCheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
}