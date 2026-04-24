import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  HelpCircle,
  Repeat,
  Sparkles,
} from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { formatBRL, formatDate } from "@/lib/format";
import { PendingType, Transaction } from "@/data/mockData";
import { toast } from "sonner";

type Filter = "todos" | PendingType;

const summary: { key: Filter; label: string; description: string; icon: any; tone: string }[] = [
  {
    key: "sem_categoria",
    label: "Sem categoria",
    description: "Lançamentos aguardando classificação",
    icon: HelpCircle,
    tone: "text-warning bg-warning/10 border-warning/30",
  },
  {
    key: "transferencia_suspeita",
    label: "Transferências suspeitas",
    description: "Movimentos que parecem ser entre suas contas",
    icon: ArrowLeftRight,
    tone: "text-primary bg-primary/10 border-primary/30",
  },
  {
    key: "recorrencia_detectada",
    label: "Recorrências detectadas",
    description: "Padrões de cobrança identificados",
    icon: Repeat,
    tone: "text-accent bg-accent/10 border-accent/30",
  },
  {
    key: "inconsistencia",
    label: "Possíveis inconsistências",
    description: "Categoria com baixa confiança",
    icon: AlertTriangle,
    tone: "text-destructive bg-destructive/10 border-destructive/30",
  },
];

const filters: { key: Filter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "sem_categoria", label: "Sem categoria" },
  { key: "transferencia_suspeita", label: "Transferências" },
  { key: "recorrencia_detectada", label: "Recorrências" },
  { key: "inconsistencia", label: "Inconsistências" },
];

const typeIcon: Record<PendingType, any> = {
  sem_categoria: HelpCircle,
  transferencia_suspeita: ArrowLeftRight,
  recorrencia_detectada: Repeat,
  inconsistencia: AlertTriangle,
};

const typeLabel: Record<PendingType, string> = {
  sem_categoria: "Sem categoria",
  transferencia_suspeita: "Transferência?",
  recorrencia_detectada: "Recorrência",
  inconsistencia: "Inconsistência",
};

const Categorizacao = () => {
  const {
    pendingList,
    pendingByType,
    categories,
    updateCategory,
    confirmTransfer,
    rejectTransfer,
    markRecurring,
    ignoreRecurrence,
    applySuggestion,
    dismissPending,
  } = useFinance();

  const [filter, setFilter] = useState<Filter>("todos");
  const [draftCategory, setDraftCategory] = useState<Record<string, string>>({});

  const visible = filter === "todos" ? pendingList : pendingList.filter((t) => t.pendingType === filter);

  const handleSaveCategory = (t: Transaction) => {
    const value = draftCategory[t.id];
    if (!value) {
      toast.error("Selecione uma categoria antes de salvar.");
      return;
    }
    updateCategory(t.id, value);
    setDraftCategory((prev) => {
      const next = { ...prev };
      delete next[t.id];
      return next;
    });
    toast.success("Categoria atualizada");
  };

  const handleCorrectInconsistency = (t: Transaction) => {
    const value = draftCategory[t.id] ?? t.suggestedCategory ?? t.category;
    updateCategory(t.id, value);
    setDraftCategory((prev) => {
      const next = { ...prev };
      delete next[t.id];
      return next;
    });
    toast.success("Categoria corrigida");
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Categorização Pendente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fila de revisão para manter seus dados financeiros limpos e confiáveis.
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map((s) => {
          const active = filter === s.key;
          const count = pendingByType[s.key as PendingType];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setFilter(active ? "todos" : s.key)}
              className={`text-left rounded-lg border bg-gradient-card p-5 transition-smooth hover:border-primary/40 ${
                active ? "ring-2 ring-primary border-primary/60" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center border ${s.tone}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <span className="text-3xl font-bold text-foreground tabular-nums">{count}</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">{s.label}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.description}</p>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f.key}
            type="button"
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            className={
              filter === f.key
                ? "bg-gradient-primary text-primary-foreground hover:opacity-90"
                : "border-border"
            }
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Lista */}
      <Card className="bg-gradient-card border-border overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-16 text-center">
            <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <p className="text-base font-semibold text-foreground">Tudo em dia</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nenhuma pendência no momento. Volte depois da próxima sincronização.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((t) => {
              const Icon = typeIcon[t.pendingType!];
              const draft = draftCategory[t.id] ?? "";
              return (
                <div key={t.id} className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Identificação */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                      t.type === "entrada" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}>
                      {t.type === "entrada" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-xs h-5 border-border bg-secondary/50 inline-flex items-center gap-1"
                        >
                          <Icon className="h-3 w-3" /> {typeLabel[t.pendingType!]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{t.account}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                        {typeof t.confidence === "number" && (
                          <span className="text-xs text-muted-foreground">
                            · confiança {Math.round(t.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      {t.pendingType === "inconsistencia" && t.suggestedCategory && (
                        <p className="mt-1.5 text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-accent" />
                          Sugestão: <span className="text-foreground font-medium">{t.suggestedCategory}</span>{" "}
                          (atual: {t.category || "—"})
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Valor */}
                  <p
                    className={`text-sm font-semibold shrink-0 lg:w-28 lg:text-right ${
                      t.type === "entrada" ? "text-success" : "text-foreground"
                    }`}
                  >
                    {t.value > 0 ? "+" : ""}
                    {formatBRL(t.value)}
                  </p>

                  {/* Ações contextuais */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {t.pendingType === "sem_categoria" && (
                      <>
                        <Select
                          value={draft}
                          onValueChange={(v) => setDraftCategory((p) => ({ ...p, [t.id]: v }))}
                        >
                          <SelectTrigger className="w-44 h-9 bg-input border-border" aria-label="Definir categoria">
                            <SelectValue placeholder="Definir categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="bg-gradient-primary text-primary-foreground hover:opacity-90"
                          onClick={() => handleSaveCategory(t)}
                        >
                          Salvar
                        </Button>
                      </>
                    )}

                    {t.pendingType === "transferencia_suspeita" && (
                      <>
                        <Button
                          size="sm"
                          className="bg-gradient-primary text-primary-foreground hover:opacity-90"
                          onClick={() => {
                            confirmTransfer(t.id);
                            toast.success("Transferência confirmada");
                          }}
                        >
                          Confirmar transferência
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            rejectTransfer(t.id);
                            toast("Removido da fila");
                          }}
                        >
                          Não é
                        </Button>
                      </>
                    )}

                    {t.pendingType === "recorrencia_detectada" && (
                      <>
                        <Button
                          size="sm"
                          className="bg-gradient-primary text-primary-foreground hover:opacity-90"
                          onClick={() => {
                            markRecurring(t.id);
                            toast.success("Marcado como recorrente");
                          }}
                        >
                          Marcar como recorrente
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            ignoreRecurrence(t.id);
                            toast("Recorrência ignorada");
                          }}
                        >
                          Ignorar
                        </Button>
                      </>
                    )}

                    {t.pendingType === "inconsistencia" && (
                      <>
                        <Select
                          value={draft || t.suggestedCategory || t.category}
                          onValueChange={(v) => setDraftCategory((p) => ({ ...p, [t.id]: v }))}
                        >
                          <SelectTrigger className="w-44 h-9 bg-input border-border" aria-label="Corrigir categoria">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="bg-gradient-primary text-primary-foreground hover:opacity-90"
                          onClick={() => {
                            if (!draft && t.suggestedCategory) {
                              applySuggestion(t.id);
                              toast.success("Sugestão aplicada");
                            } else {
                              handleCorrectInconsistency(t);
                            }
                          }}
                        >
                          Corrigir
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            dismissPending(t.id);
                            toast("Marcado como ok");
                          }}
                        >
                          Está correto
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Categorizacao;
