import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Bloqueia o acesso ao app até o usuário aceitar a política. Persistido em
// profiles.consent_accepted_at — só aparece uma vez.
export function ConsentGate() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("consent_accepted_at")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!data?.consent_accepted_at) setOpen(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleAccept = async () => {
    if (!user || !checked) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ consent_accepted_at: new Date().toISOString() })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível registrar seu consentimento.");
      return;
    }
    // Trilha de auditoria (best-effort).
    await supabase.from("audit_log").insert({
      user_id: user.id,
      event_type: "consent.accepted",
      event_details: { version: "1.0" },
    });
    setOpen(false);
  };

  const handleDecline = async () => {
    await signOut();
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={() => { /* não pode fechar sem decisão */ }}>
      <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Privacidade e consentimento</DialogTitle>
          <DialogDescription>
            Antes de continuar, precisamos do seu consentimento expresso.
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-foreground space-y-3 py-2">
          <p>
            A Nivra coleta seus dados financeiros via Open Finance regulado, em modo somente leitura,
            para exibir extratos consolidados e indicadores. Não pedimos senha bancária e não
            iniciamos pagamentos.
          </p>
          <ul className="list-disc ml-5 text-xs text-muted-foreground space-y-1">
            <li>Criptografia em trânsito (TLS) e em repouso (AES-256).</li>
            <li>Seus dados são apagados em até 24 meses ou imediatamente se você excluir a conta.</li>
            <li>Você pode exportar ou excluir tudo a qualquer momento em Configurações.</li>
          </ul>

          <div className="flex items-start gap-2 pt-2">
            <Checkbox
              id="consent"
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="consent" className="text-xs leading-relaxed cursor-pointer">
              Li e concordo com a{" "}
              <a href="/privacidade" target="_blank" rel="noreferrer" className="text-primary underline">
                Política de Privacidade
              </a>{" "}
              e os{" "}
              <a href="/termos" target="_blank" rel="noreferrer" className="text-primary underline">
                Termos de Uso
              </a>
              , e consinto com o tratamento dos meus dados financeiros via Open Finance.
            </Label>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleDecline} disabled={saving}>
            Não concordo / sair
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!checked || saving}
            className="bg-gradient-primary text-primary-foreground"
          >
            {saving ? "Registrando..." : "Concordo e continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}