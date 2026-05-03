import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function PrivacyDataCard() {
  const { user, signOut } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [open, setOpen] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão não encontrada");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/account-export`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast.error("Não foi possível exportar seus dados.");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `nivra-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Exportação concluída.");
    } catch (e) {
      toast.error("Erro ao exportar dados.");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.email) return;
    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      toast.error("E-mail digitado não confere.");
      return;
    }
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão não encontrada");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/account-delete`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm_email: confirmEmail.trim() }),
      });
      if (!res.ok) {
        toast.error("Não foi possível excluir a conta. Contate o suporte.");
        return;
      }
      toast.success("Conta excluída. Até logo.");
      setOpen(false);
      await signOut();
      window.location.href = "/";
    } catch (e) {
      toast.error("Erro ao excluir conta.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="bg-gradient-card border-border p-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShieldAlert className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Privacidade e dados (LGPD)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Exerça seus direitos de portabilidade e exclusão a qualquer momento.
          </p>
        </div>
      </div>
      <Separator className="my-5" />

      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Exportar meus dados</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Baixe um arquivo JSON com tudo o que armazenamos sobre você (perfil, conexões, transações, configurações).
            </p>
          </div>
          <Button onClick={handleExport} disabled={exporting} variant="outline" className="shrink-0">
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Gerando..." : "Exportar (JSON)"}
          </Button>
        </div>

        <Separator />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-destructive">Excluir minha conta</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Revoga todas as conexões bancárias na origem (Open Finance) e apaga seus dados de forma permanente. Esta ação não pode ser desfeita.
            </p>
          </div>
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="shrink-0">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir conta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir sua conta permanentemente?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vamos revogar suas conexões bancárias e apagar perfil, transações, configurações e histórico de auditoria.
                  Esta ação é irreversível.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="confirmEmail">
                  Digite seu e-mail (<span className="font-mono">{user?.email}</span>) para confirmar
                </Label>
                <Input
                  id="confirmEmail"
                  type="email"
                  autoComplete="off"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={user?.email}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); handleDelete(); }}
                  disabled={deleting || confirmEmail.trim().toLowerCase() !== (user?.email ?? "").toLowerCase()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Excluindo..." : "Excluir definitivamente"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
}