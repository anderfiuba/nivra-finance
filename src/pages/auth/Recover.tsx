import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Recover = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      toast.error("Não foi possível enviar o link", { description: error.message });
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="px-6 py-10 md:px-12">
        <Link to="/"><Logo /></Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm animate-fade-in-up">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" /> Voltar ao login
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Recuperar senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Informe seu e-mail e enviaremos um link para redefinir sua senha.
          </p>
          {!sent ? (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-input border-border"
                  placeholder="voce@exemplo.com"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant"
              >
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
            </form>
          ) : (
            <div className="mt-8 rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-foreground">
              Link enviado. Verifique sua caixa de entrada para continuar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Recover;
