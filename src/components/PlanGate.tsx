import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useSubscription } from "@/hooks/useSubscription";

interface Props {
  feature: "faturas" | "categorizacao";
  children: ReactNode;
}

const COPY: Record<Props["feature"], { title: string; bullets: string[] }> = {
  faturas: {
    title: "Faturas é um recurso do plano Plus",
    bullets: [
      "Visualize e acompanhe faturas de cartão",
      "Entenda vencimentos, valores e pagamentos",
      "Tenha mais controle sobre os gastos no cartão",
    ],
  },
  categorizacao: {
    title: "Categorização é um recurso do plano Plus",
    bullets: [
      "Organize e corrija categorias das transações",
      "Melhore a leitura financeira do extrato",
      "Gere análises e resumos mais precisos",
    ],
  },
};

export function PlanGate({ feature, children }: Props) {
  const { isPlus, loading } = useSubscription();
  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
        <div className="h-40 rounded-lg bg-muted/30 animate-pulse" />
      </div>
    );
  }
  if (isPlus) return <>{children}</>;

  const { title, bullets } = COPY[feature];
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <Card className="p-8 bg-gradient-card border-primary/30 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <h2 className="mt-4 text-xl md:text-2xl font-semibold text-foreground">{title}</h2>
        <ul className="mt-5 space-y-2 text-sm text-muted-foreground text-left max-w-md mx-auto">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Crown className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-col sm:flex-row gap-2 justify-center">
          <Button asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant">
            <Link to="/app/planos">Fazer upgrade para Plus</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}