import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Se já estiver logado, redireciona.
  useEffect(() => {
    if (user) {
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/app";
      navigate(from, { replace: true });
    }
  }, [user, location.state, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      const msg = error.message.includes("Invalid login credentials")
        ? "Email ou senha incorretos."
        : error.message;
      toast.error("Não foi possível entrar", { description: msg });
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate("/app", { replace: true });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="flex flex-col px-6 py-10 md:px-12">
        <Link to="/"><Logo /></Link>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm animate-fade-in-up">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Bem-vindo de volta</h1>
            <p className="mt-2 text-sm text-muted-foreground">Acesse sua conta Nivra para continuar.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@exemplo.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-input border-border"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link to="/recuperar" className="text-xs text-primary hover:underline">Esqueceu a senha?</Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-input border-border"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant">
                {loading ? "Entrando..." : <>Entrar <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Não tem uma conta?{" "}
              <Link to="/signup" className="text-primary hover:underline font-medium">Criar conta</Link>
            </p>

            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Conexão segura, criptografia bancária
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex relative bg-gradient-hero items-center justify-center p-12 border-l border-border">
        <div className="absolute inset-0 bg-gradient-mesh opacity-60" />
        <div className="relative max-w-md">
          <Card className="bg-card/80 backdrop-blur border-border p-8 shadow-elegant">
            <p className="text-xs uppercase tracking-wider text-accent font-medium">Saldo consolidado</p>
            <p className="mt-2 text-4xl font-bold text-foreground">R$ 145.186,55</p>
            <p className="mt-1 text-sm text-success">+12,4% este mês</p>
            <div className="mt-6 h-32 flex items-end gap-2">
              {[40, 65, 50, 78, 60, 92, 85, 100, 75, 88, 95, 110].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-gradient-primary opacity-80" style={{ height: `${h}%` }} />
              ))}
            </div>
          </Card>
          <p className="mt-8 text-center text-lg text-foreground font-medium leading-relaxed">
            "Finalmente sei para onde vai meu dinheiro, sem planilhas."
          </p>
          <p className="mt-2 text-center text-sm text-muted-foreground">— Conta conectada com segurança bancária</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
