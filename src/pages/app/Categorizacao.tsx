import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { formatBRL, formatDate } from "@/lib/format";
import { PendingType, Transaction } from "@/data/mockData";
import { toast } from "sonner";

const Categorizacao = () => {
  const {
    pendingList,
    pendingByType,
    categories,
    updateCategory,
  } = useFinance();

  const [draftCategory, setDraftCategory] = useState<Record<string, string>>({});

  // Mantemos apenas itens "sem categoria" na fila de pendências.
  const visible = pendingList.filter((t) => t.pendingType === "sem_categoria");
  const semCategoriaCount = pendingByType.sem_categoria;

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

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Categorização Pendente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lançamentos sem categoria atribuída — defina uma categoria para cada um.
        </p>
      </div>

      {/* Card de resumo único — Sem categoria */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-card border-border p-5">
          <div className="flex items-start justify-between">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center border text-warning bg-warning/10 border-warning/30">
              <HelpCircle className="h-4 w-4" />
            </div>
            <span className="text-3xl font-bold text-foreground tabular-nums">{semCategoriaCount}</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">Sem categoria</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Lançamentos aguardando classificação manual.
          </p>
        </Card>
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
                          <HelpCircle className="h-3 w-3" /> Sem categoria
                        </Badge>
                        <span className="text-xs text-muted-foreground">{t.account}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Valor */}
                  <p
                    className={`text-sm font-semibold shrink-0 lg:w-28 lg:text-right ${
                      t.type === "entrada" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {t.type === "entrada" ? "+" : "-"}
                    {formatBRL(t.value)}
                  </p>

                  {/* Ações contextuais */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
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
