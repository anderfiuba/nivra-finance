import { useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment, PLUS_PRICE_ID } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StripeCheckoutDialog({ open, onOpenChange }: Props) {
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const returnUrl = `${window.location.origin}/app/planos?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        priceId: PLUS_PRICE_ID,
        environment: getStripeEnvironment(),
        returnUrl,
      },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message ?? "Falha ao iniciar checkout.");
    }
    return data.clientSecret as string;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Assinar Nivra Plus</DialogTitle>
          <DialogDescription>R$ 29,90/mês — cancele quando quiser.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[80vh] overflow-y-auto p-2">
          {open && (
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}