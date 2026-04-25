import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownRight, ArrowUpRight, Download, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useFinance } from "@/contexts/FinanceContext";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";

const Extrato = () => {
  const { transactions, categories, updateCategory } = useFinance();
  const [search, setSearch] = useState("");
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState("all");

  const accountOptions = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.account))),
    [transactions],
  );

  // Apenas categorias PAI (top-level Pluggy). UI simplificada.
  const parentCategories = useMemo(() => {
    return categories
      .filter((c) => c.parentId === null)
      .map((c) => ({ id: c.id, label: c.descriptionTranslated ?? c.description }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories]);

  const categoryFilterOptions = useMemo(
    () => parentCategories.map((p) => p.label),
    [parentCategories],
  );

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (account !== "all" && t.account !== account) return false;
      if (category !== "all" && t.category !== category) return false;
      return true;
    });
  }, [transactions, search, account, category]);

  const handleChangeCategory = (id: string, label: string) => {
    updateCategory(id, label);
    toast.success("Categoria atualizada");
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Extrato Unificado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas as movimentações de todas as contas em uma única visão. Edite a categoria direto na lista.
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" /> Exportar
        </Button>
      </div>

      <Card className="bg-gradient-card border-border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descrição..."
              className="pl-9 bg-input border-border h-10"
            />
          </div>
          <Select value={account} onValueChange={setAccount}>
            <SelectTrigger className="w-full lg:w-48 bg-input border-border">
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accountOptions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full lg:w-48 bg-input border-border">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categoryFilterOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="shrink-0">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Card className="bg-gradient-card border-border overflow-hidden">
        <div className="divide-y divide-border">
          {filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhuma transação encontrada com os filtros aplicados.
            </div>
          )}
          {filtered.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-smooth"
            >
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                  t.type === "entrada" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                }`}
              >
                {t.type === "entrada" ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Select
                    value={t.category || ""}
                    onValueChange={(v) => handleChangeCategory(t.id, v)}
                  >
                    <SelectTrigger
                      className="h-7 px-2 text-xs w-auto min-w-[140px] bg-secondary/50 border-border hover:border-primary/40 transition-smooth"
                      aria-label="Categoria da transação"
                    >
                      <SelectValue placeholder="Sem categoria" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {parentCategories.length === 0 ? (
                        <SelectItem value="__none" disabled>Carregando categorias…</SelectItem>
                      ) : (
                        parentCategories.map((it) => (
                          <SelectItem key={it.id} value={it.label}>{it.label}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">{t.account}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-sm font-semibold ${
                    t.type === "entrada" ? "text-success" : "text-destructive"
                  }`}
                >
                  {t.type === "entrada" ? "+" : "−"}
                  {formatBRL(t.value)}
                </p>
                {t.originalCurrency && t.originalAmount !== undefined && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {Math.abs(t.originalAmount).toFixed(2)} {t.originalCurrency}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(t.date)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Extrato;
