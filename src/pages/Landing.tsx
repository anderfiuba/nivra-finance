import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ArrowRight, Brain, Check, Eye, Lock, ShieldCheck, Sparkles, Wallet, Zap, BarChart3, KeyRound, FileLock2, FileCheck2 } from "lucide-react";
import { Card } from "@/components/ui/card";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#produto" className="hover:text-foreground transition-smooth">Produto</a>
            <a href="#como-funciona" className="hover:text-foreground transition-smooth">Como funciona</a>
            <a href="#seguranca" className="hover:text-foreground transition-smooth">Segurança</a>
            <a href="#planos" className="hover:text-foreground transition-smooth">Planos</a>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm" className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant">
              <Link to="/signup">Criar conta</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="absolute inset-0 bg-gradient-mesh opacity-60" />
        <div className="container relative py-24 md:py-32">
          <div className="mx-auto max-w-4xl text-center animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur mb-8">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Inteligência financeira via Open Finance
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground leading-[1.05]">
              Clareza total sobre <br />
              <span className="text-gradient-primary">para onde vai seu dinheiro.</span>
            </h1>
            <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Centralize todas as suas contas, leia extratos automaticamente via Open Finance e receba inteligência financeira pronta para decisão. Sem planilhas. Sem retrabalho.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant h-12 px-8 text-base">
                <Link to="/signup">
                  Começar gratuitamente <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base border-border bg-card/40 backdrop-blur">
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" /> Regulado pelo Banco Central</div>
              <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-success" /> Criptografia de ponta a ponta</div>
              <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-success" /> Apenas leitura, jamais movimenta</div>
            </div>
          </div>

          {/* Hero Card Preview */}
          <div className="mt-20 mx-auto max-w-5xl">
            <div className="relative rounded-2xl border border-border bg-gradient-card p-2 shadow-elegant">
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
                  {[
                    { label: "Saldo consolidado", value: "R$ 145.186,55", trend: "+12,4%" },
                    { label: "Entradas no mês", value: "R$ 14.900,00", trend: "+8,2%" },
                    { label: "Saídas no mês", value: "R$ 6.450,00", trend: "-23,1%" },
                  ].map((kpi, i) => (
                    <div key={i} className="bg-card p-6">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{kpi.value}</p>
                      <p className="mt-1 text-xs text-success">{kpi.trend} vs mês anterior</p>
                    </div>
                  ))}
                </div>
                <div className="p-8 bg-gradient-card">
                  <div className="h-48 flex items-end gap-3">
                    {[40, 65, 50, 78, 60, 92, 85, 100, 75, 88, 95, 110].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t bg-gradient-primary opacity-80" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain section */}
      <section className="py-24 border-t border-border/40">
        <div className="container">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-accent uppercase tracking-wider">O problema real</p>
            <h2 className="mt-4 text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              Você abre o app do banco e ainda não sabe para onde foi o dinheiro.
            </h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Extratos confusos, contas espalhadas em vários bancos, planilhas que ninguém atualiza. O resultado é o mesmo todo mês: surpresas no final, decisões no escuro, oportunidades perdidas.
            </p>
          </div>
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            {[
              { title: "Dados espalhados", text: "Cada banco em um app, cada cartão em uma fatura. Nada conversa." },
              { title: "Categorização manual", text: "Horas perdidas tentando classificar gastos em planilhas que envelhecem rápido." },
              { title: "Zero inteligência", text: "Você vê números, mas não enxerga padrões, recorrências ou anomalias." },
            ].map((item, i) => (
              <Card key={i} className="bg-gradient-card border-border p-6">
                <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center mb-4">
                  <span className="text-destructive text-lg">✕</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Produto / Benefícios */}
      <section id="produto" className="py-24 bg-gradient-card border-y border-border/40">
        <div className="container">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary uppercase tracking-wider">A solução Nivra</p>
            <h2 className="mt-4 text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              Uma única plataforma para enxergar, entender e decidir.
            </h2>
          </div>
          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Wallet, title: "Contas centralizadas", desc: "Conecte todos os seus bancos e veja saldo, extrato e movimentações em um só lugar." },
              { icon: Zap, title: "Open Finance integrado", desc: "Sincronização automática e segura de dados bancários, sem digitação manual." },
              { icon: BarChart3, title: "Dashboards executivos", desc: "Visão clara de receitas, despesas, fluxo e evolução do seu patrimônio." },
              { icon: Brain, title: "Inteligência com IA", desc: "Insights práticos: anomalias, recorrências, padrões e oportunidades de economia." },
              { icon: ShieldCheck, title: "Segurança bancária", desc: "Padrão regulado pelo Banco Central. Apenas leitura, nunca movimentação." },
              { icon: Eye, title: "Categorização automática", desc: "Cada transação classificada na hora. Você vê o que importa, sem trabalho manual." },
            ].map((item, i) => (
              <Card key={i} className="bg-card border-border p-6 hover:border-primary/40 transition-smooth group">
                <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-smooth">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="py-24">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm font-medium text-accent uppercase tracking-wider">Como funciona</p>
            <h2 className="mt-4 text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              Três passos. Visão completa em minutos.
            </h2>
          </div>
          <div className="mt-16 grid md:grid-cols-3 gap-8">
            {[
              { n: "01", title: "Conecte seus bancos", desc: "Autorize o compartilhamento via Open Finance em segundos. 100% regulado pelo BCB." },
              { n: "02", title: "Nivra organiza tudo", desc: "Extratos lidos, transações categorizadas e dados consolidados automaticamente." },
              { n: "03", title: "Decida com clareza", desc: "Dashboards, alertas e insights de IA prontos para você agir, sem ruído." },
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="text-6xl font-bold text-gradient-primary opacity-90">{step.n}</div>
                <h3 className="mt-4 text-xl font-semibold text-foreground">{step.title}</h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      {/* Segurança */}
      <section id="seguranca" className="py-24 border-t border-border/40">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur mb-6">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Segurança em primeiro lugar
            </div>
            <p className="text-sm font-medium text-primary uppercase tracking-wider">Padrão bancário de proteção</p>
            <h2 className="mt-4 text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              Sua confiança é construída em <span className="text-gradient-primary">camadas de segurança.</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Seguimos as melhores práticas do OWASP, da LGPD e do Open Finance Brasil para proteger seus dados financeiros em cada ponto da arquitetura — do navegador ao banco de dados.
            </p>
          </div>

          <div className="mt-16 grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: Lock,
                title: "Conexão criptografada (HTTPS/TLS)",
                desc: "Todo o tráfego entre você e a Nivra usa HTTPS com TLS, protegendo seus dados durante a navegação e o acesso aos extratos.",
              },
              {
                icon: KeyRound,
                title: "Login com senha forte",
                desc: "Cadastro exige senha com letra maiúscula, minúscula, número, caractere especial e mínimo de 8 caracteres. Autenticação gerenciada por provedor especializado.",
              },
              {
                icon: Eye,
                title: "Open Finance: apenas leitura",
                desc: "A integração via Pluggy / Open Finance Brasil é exclusivamente de leitura. A Nivra nunca movimenta dinheiro, transfere ou paga em seu nome.",
              },
              {
                icon: FileLock2,
                title: "Isolamento de dados por usuário",
                desc: "Cada usuário só enxerga seus próprios dados, com regras de acesso aplicadas no banco (Row Level Security). Conexões bancárias podem ser desconectadas a qualquer momento.",
              },
            ].map((item, i) => (
              <Card key={i} className="bg-gradient-card border-border p-6 hover:border-primary/40 transition-smooth group">
                <div className="h-11 w-11 rounded-lg bg-success/10 flex items-center justify-center mb-4 group-hover:bg-success/20 transition-smooth">
                  <item.icon className="h-5 w-5 text-success" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </Card>
            ))}
          </div>

          {/* LGPD & Privacidade */}
          <div className="mt-12 max-w-5xl mx-auto">
            <Card className="bg-gradient-card border-border p-8 md:p-10">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileCheck2 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-foreground">Privacidade por padrão · LGPD</h3>
                  <p className="mt-3 text-muted-foreground leading-relaxed">
                    Coletamos apenas o necessário e informamos com clareza a finalidade, a base legal e eventuais compartilhamentos dos seus dados. A segurança é incorporada desde a concepção do serviço (privacy by design), tratamento essencial para o contexto sensível do Open Finance e da leitura de extratos bancários.
                  </p>
                  <div className="mt-5 grid sm:grid-cols-3 gap-3 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-success shrink-0" />
                      Conformidade com a LGPD
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-success shrink-0" />
                      Regulado pelo Banco Central
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-success shrink-0" />
                      Apenas leitura, jamais movimenta
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <p className="mt-10 text-center text-xs text-muted-foreground max-w-2xl mx-auto">
            Saiba mais em nossa{" "}
            <Link to="/privacidade" className="underline hover:text-foreground">Política de Privacidade</Link>
            {" "}e nos{" "}
            <Link to="/termos" className="underline hover:text-foreground">Termos de Uso</Link>.
          </p>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="py-24 bg-gradient-card border-y border-border/40">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm font-medium text-primary uppercase tracking-wider">Planos</p>
            <h2 className="mt-4 text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              Escolha o nível de inteligência que você precisa.
            </h2>
            <p className="mt-4 text-muted-foreground">Sem compromisso. Cancele quando quiser.</p>
          </div>

          <div className="mt-16 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: "Free", price: "R$ 0", period: "para sempre",
                features: ["1 conexão bancária", "Extrato unificado básico", "Dashboard simples", "Categorização automática"],
                cta: "Começar grátis", highlight: false,
              },
              {
                name: "Plus", price: "R$ 39,90", period: "por mês",
                features: ["Até 3 conexões bancárias", "Extrato unificado completo", "Dashboard com insights de IA", "Detecção de recorrências", "Alertas inteligentes"],
                cta: "Assinar Plus", highlight: true,
              },
              {
                name: "Pro", price: "R$ 59,90", period: "por mês",
                features: ["Conexões ilimitadas", "Tudo do Plus", "Cadastro de Pessoa Jurídica", "Contas empresariais", "Suporte prioritário"],
                cta: "Assinar Pro", highlight: false,
              },
            ].map((plan) => (
              <Card key={plan.name} className={`relative p-8 ${plan.highlight ? "bg-card border-primary/50 shadow-elegant" : "bg-card border-border"}`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-primary text-primary-foreground text-xs font-semibold">
                    Mais popular
                  </div>
                )}
                <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
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
                  asChild
                  className={`mt-8 w-full ${plan.highlight ? "bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant" : ""}`}
                  variant={plan.highlight ? "default" : "outline"}
                >
                  <Link to="/signup">{plan.cta}</Link>
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24">
        <div className="container">
          <Card className="relative overflow-hidden bg-gradient-card border-border p-12 md:p-16 text-center">
            <div className="absolute inset-0 bg-gradient-mesh opacity-50" />
            <div className="relative max-w-2xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
                Comece a enxergar suas finanças <span className="text-gradient-primary">como nunca antes.</span>
              </h2>
              <p className="mt-6 text-lg text-muted-foreground">
                Crie sua conta gratuita em menos de um minuto. Sem cartão de crédito.
              </p>
              <Button asChild size="lg" className="mt-8 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant h-12 px-8">
                <Link to="/signup">
                  Criar minha conta <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo />
          <p className="text-xs text-muted-foreground">© 2025 Nivra. Inteligência financeira pessoal.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
