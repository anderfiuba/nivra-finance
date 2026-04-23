import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const Configuracoes = () => {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie sua conta, segurança e preferências.</p>
      </div>

      <Card className="bg-gradient-card border-border p-6">
        <h3 className="text-base font-semibold text-foreground">Perfil</h3>
        <p className="text-xs text-muted-foreground mt-1">Informações da sua conta.</p>
        <Separator className="my-5" />
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" defaultValue="Rafael Silva" className="bg-input border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" defaultValue="rafael@exemplo.com" className="bg-input border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" defaultValue="+55 11 99999-9999" className="bg-input border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" defaultValue="123.456.789-00" className="bg-input border-border" />
          </div>
        </div>
        <div className="mt-6">
          <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90">Salvar alterações</Button>
        </div>
      </Card>

      <Card className="bg-gradient-card border-border p-6">
        <h3 className="text-base font-semibold text-foreground">Segurança</h3>
        <p className="text-xs text-muted-foreground mt-1">Mantenha sua conta protegida.</p>
        <Separator className="my-5" />
        <div className="space-y-5">
          {[
            { title: "Autenticação em dois fatores", desc: "Adicione uma camada extra de segurança ao seu login.", on: true },
            { title: "Alertas de novo dispositivo", desc: "Seja notificado quando alguém acessar sua conta de um novo aparelho.", on: true },
            { title: "Bloqueio automático", desc: "Solicitar senha após 15 minutos de inatividade.", on: false },
          ].map((item, i) => (
            <div key={i} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <Switch defaultChecked={item.on} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="bg-gradient-card border-border p-6">
        <h3 className="text-base font-semibold text-foreground">Preferências</h3>
        <p className="text-xs text-muted-foreground mt-1">Personalize sua experiência.</p>
        <Separator className="my-5" />
        <div className="space-y-5">
          {[
            { title: "Resumo semanal por e-mail", desc: "Receba um panorama financeiro toda segunda-feira.", on: true },
            { title: "Insights de IA em tempo real", desc: "Notificações instantâneas para anomalias e oportunidades.", on: true },
            { title: "Tema escuro", desc: "Ativo por padrão.", on: true },
          ].map((item, i) => (
            <div key={i} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <Switch defaultChecked={item.on} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Configuracoes;
