import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { useState } from "react";

const Signup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => navigate("/app"), 600);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="flex flex-col px-6 py-10 md:px-12">
        <Link to="/"><Logo /></Link>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm animate-fade-in-up">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Crie sua conta</h1>
            <p className="mt-2 text-sm text-muted-foreground">Comece grátis. Sem cartão de crédito.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" required className="h-11 bg-input border-border" placeholder="Seu nome" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required className="h-11 bg-input border-border" placeholder="voce@exemplo.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required className="h-11 bg-input border-border" placeholder="Mínimo 8 caracteres" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant">
                {loading ? "Criando conta..." : <>Criar conta gratuita <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">Entrar</Link>
            </p>

            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Seus dados protegidos por criptografia bancária
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex relative bg-gradient-hero items-center justify-center p-12 border-l border-border">
        <div className="absolute inset-0 bg-gradient-mesh opacity-60" />
        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl font-bold text-foreground">Inteligência financeira em minutos</h2>
          {[
            "Conecte todos os seus bancos via Open Finance",
            "Extratos consolidados e categorizados automaticamente",
            "Insights de IA prontos para decisão",
            "Padrão de segurança regulado pelo Banco Central",
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-3 text-foreground">
              <div className="h-6 w-6 rounded-full bg-success/15 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="h-3.5 w-3.5 text-success" />
              </div>
              <span className="text-sm leading-relaxed">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Signup;
