import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { ArrowRight, Check, Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";

interface PasswordChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  special: boolean;
}

function evaluatePassword(password: string): PasswordChecks {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

const Signup = () => {
  const navigate = useNavigate();
  const { signUp, user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [cpfTouched, setCpfTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/app", { replace: true });
  }, [user, navigate]);

  const passwordChecks = useMemo(() => evaluatePassword(password), [password]);
  const passwordValid =
    passwordChecks.length &&
    passwordChecks.upper &&
    passwordChecks.lower &&
    passwordChecks.digit &&
    passwordChecks.special;
  const cpfDigits = useMemo(() => normalizeCpf(cpf), [cpf]);
  const cpfValid = isValidCpf(cpfDigits);
  const cpfError = cpfTouched && cpfDigits.length > 0 && !cpfValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpfTouched(true);
    if (!passwordValid) {
      toast.error("Senha não atende aos requisitos", {
        description: "Use ao menos 8 caracteres com maiúscula, minúscula, número e caractere especial.",
      });
      return;
    }
    if (!cpfValid) {
      toast.error("CPF inválido", {
        description: "Confira os números digitados. O CPF informado não é válido.",
      });
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    if (error) {
      setLoading(false);
      const msg = error.message.includes("already registered")
        ? "Este email já possui uma conta. Faça login."
        : error.message;
      toast.error("Não foi possível criar a conta", { description: msg });
      return;
    }
    // Persiste o CPF no perfil. O trigger handle_new_user cria a linha em profiles;
    // aqui apenas atualizamos o campo cpf.
    const { data: sessionData } = await supabase.auth.getSession();
    const newUserId = sessionData.session?.user?.id;
    if (newUserId) {
      const { error: cpfError } = await supabase
        .from("profiles")
        .update({ cpf: cpfDigits })
        .eq("id", newUserId);
      if (cpfError) {
        // Se o CPF já está cadastrado em outra conta, o índice único barra.
        const isDuplicate = /duplicate|unique/i.test(cpfError.message);
        toast.error("Não foi possível salvar o CPF", {
          description: isDuplicate
            ? "Este CPF já está em uso por outra conta."
            : "Tente novamente nas configurações do perfil.",
        });
      }
    }
    setLoading(false);
    toast.success("Conta criada com sucesso!");
    navigate("/app", { replace: true });
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
                <Input
                  id="name"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 bg-input border-border"
                  placeholder="Seu nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  value={formatCpf(cpf)}
                  onChange={(e) => setCpf(e.target.value)}
                  onBlur={() => setCpfTouched(true)}
                  maxLength={14}
                  className={cn(
                    "h-11 bg-input border-border",
                    cpfError && "border-destructive focus-visible:ring-destructive",
                  )}
                  placeholder="000.000.000-00"
                  aria-invalid={cpfError || undefined}
                  aria-describedby="cpf-help"
                />
                <p
                  id="cpf-help"
                  className={cn(
                    "text-xs",
                    cpfError ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {cpfError
                    ? "CPF inválido. Verifique os dígitos."
                    : "Apenas números. Usado para identificação no Open Finance."}
                </p>
              </div>
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
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 bg-input border-border pr-11"
                    placeholder="Crie uma senha forte"
                    aria-describedby="password-rules"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-smooth"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <ul id="password-rules" className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-3 text-xs">
                  <PasswordRule ok={passwordChecks.length} label="Mínimo 8 caracteres" />
                  <PasswordRule ok={passwordChecks.upper} label="1 letra maiúscula" />
                  <PasswordRule ok={passwordChecks.lower} label="1 letra minúscula" />
                  <PasswordRule ok={passwordChecks.digit} label="1 número" />
                  <PasswordRule ok={passwordChecks.special} label="1 caractere especial" />
                </ul>
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

function PasswordRule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      className={cn(
        "flex items-center gap-1.5",
        ok ? "text-success" : "text-muted-foreground",
      )}
    >
      {ok ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0 opacity-60" />}
      <span>{label}</span>
    </li>
  );
}
