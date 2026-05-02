import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown } from "lucide-react";

const plans = [
  {
    name: "Free", price: "R$ 0", period: "para sempre", current: false,
    features: ["1 conexão bancária", "Extrato unificado básico", "Dashboard simples", "Categorização automática"],
  },
  {
    name: "Plus", price: "R$ 39,90", period: "por mês", current: true, popular: true,
    features: ["Até 3 conexões bancárias", "Extrato unificado completo", "Dashboard com insights de IA", "Detecção de recorrências", "Alertas inteligentes"],
  },
  {
    name: "Pro", price: "R$ 59,90", period: "por mês", current: false,
    features: ["Conexões ilimitadas", "Tudo do Plus", "Cadastro de Pessoa Jurídica", "Contas empresariais", "Suporte prioritário"],
  },
];

const Planos = () => {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Planos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Escolha o nível de inteligência que você precisa. Cancele quando quiser.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`relative p-7 transition-smooth ${
              plan.popular
                ? "bg-card border-primary/50 shadow-elegant"
                : "bg-card shadow-none border-border hover:border-primary/30"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-primary text-primary-foreground text-xs font-semibold">
                Mais popular
              </div>
            )}
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                {plan.name === "Pro" && <Crown className="h-4 w-4 text-accent" />}
                {plan.name}
              </h3>
              {plan.current && (
                <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10">Plano atual</Badge>
              )}
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">{plan.price}</span>
              <span className="text-sm text-muted-foreground">{plan.period}</span>
            </div>
            <ul className="mt-6 space-y-3">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              className={`mt-7 w-full ${plan.popular ? "bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant" : ""}`}
              variant={plan.current ? "outline" : plan.popular ? "default" : "outline"}
              disabled={plan.current}
            >
              {plan.current ? "Plano atual" : `Assinar ${plan.name}`}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Planos;
