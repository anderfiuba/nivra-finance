import { Link, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

const CheckoutReturn = () => {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="p-8 max-w-md w-full text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          {sessionId ? "Pagamento processado" : "Sessão não encontrada"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {sessionId
            ? "Sua assinatura será ativada em alguns segundos. Você já pode acessar o app."
            : "Não recebemos a confirmação do checkout."}
        </p>
        <Button asChild className="mt-6 w-full">
          <Link to="/app">Ir para o app</Link>
        </Button>
      </Card>
    </div>
  );
};

export default CheckoutReturn;