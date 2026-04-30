import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFinance } from "@/contexts/FinanceContext";
import { toast } from "sonner";
import { lastNMonths, monthKeyOf, currentMonthBucket } from "@/lib/months";
import { PeriodFilter, type PeriodValue } from "@/components/extrato/PeriodFilter";
import { MonthSummaryCard } from "@/components/extrato/MonthSummaryCard";
import { TransactionRow } from "@/components/extrato/TransactionRow";

const PAGE_INCREMENT = 100;

const Extrato = () => {
  const { transactions, categories, updateCategory, accounts } = useFinance();
  const [searchParams, setSearchParams] = useSearchParams();
  const [period, setPeriod] = useState<PeriodValue>(() => ({
    mode: "month",
    monthKey: currentMonthBucket().key,
  }));
  const [search, setSearch] = useState("");
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState<string>(() => searchParams.get("category") ?? "all");
  const [flow, setFlow] = useState<"all" | "entrada" | "saida">("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_INCREMENT);

  // Sincroniza o filtro de categoria com a query string (?category=...).
  // Permite vir já filtrado da Pocket View / Disponível.
  useEffect(() => {
    const fromUrl = searchParams.get("category");
    if (fromUrl && fromUrl !== category) setCategory(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (category === "all") next.delete("category");
    else next.set("category", category);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // 12 meses fixos (mesmo que ainda não haja dados em alguns) — Pluggy entrega 12m.
  const months = useMemo(() => lastNMonths(12), []);

  const accountOptions = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.account))).sort(),
    [transactions],
  );

  // Apenas categorias PAI (top-level Pluggy). UI simplificada.
  const parentCategories = useMemo(() => {
    return categories
      .filter((c) => c.parentId === null)
      .map((c) => ({ id: c.id, label: c.descriptionTranslated ?? c.description }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories]);

  // Mapa: nome amigável da conta → URL do logo do banco (vindo do connector).
  // Usa o mesmo "name" que o TransactionRow recebe em `tx.account`.
  const accountLogoByName = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const a of accounts) {
      const key = a.marketingName || a.name;
      if (key && !m.has(key)) m.set(key, a.connectorImageUrl);
    }
    return m;
  }, [accounts]);

  // Transações dentro do período selecionado (sem outros filtros) — base para o resumo.
  const monthTransactions = useMemo(() => {
    if (period.mode === "all") return transactions;
    if (period.mode === "month") {
      const k = period.monthKey ?? "";
      return transactions.filter((t) => monthKeyOf(t.date) === k);
    }
    if (period.mode === "last3") {
      const keys = new Set(lastNMonths(3).map((m) => m.key));
      return transactions.filter((t) => keys.has(monthKeyOf(t.date)));
    }
    // custom
    const from = period.range?.from;
    const to = period.range?.to;
    if (!from || !to) return [];
    const fromTs = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0).getTime();
    const toTs = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime();
    return transactions.filter((t) => {
      const d = new Date(t.date).getTime();
      return d >= fromTs && d <= toTs;
    });
  }, [transactions, period]);

  const monthTotals = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const t of monthTransactions) {
      if (t.type === "entrada") entradas += t.value;
      else saidas += t.value;
    }
    return { count: monthTransactions.length, entradas, saidas };
  }, [monthTransactions]);

  // Aplica busca/conta/categoria sobre as transações do mês.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monthTransactions.filter((t) => {
      if (q && !t.description.toLowerCase().includes(q)) return false;
      if (account !== "all" && t.account !== account) return false;
      if (category !== "all" && t.category !== category) return false;
      if (flow !== "all" && t.type !== flow) return false;
      return true;
    });
  }, [monthTransactions, search, account, category, flow]);

  // Totais já considerando o filtro aplicado (busca/conta/categoria).
  const filteredTotals = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const t of filtered) {
      if (t.type === "entrada") entradas += t.value;
      else saidas += t.value;
    }
    return { count: filtered.length, entradas, saidas };
  }, [filtered]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const handleChangeCategory = (id: string, label: string) => {
    updateCategory(id, label);
    toast.success("Categoria atualizada");
  };

  const handlePeriodChange = (v: PeriodValue) => {
    setPeriod(v);
    setVisibleCount(PAGE_INCREMENT);
  };

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 max-w-[1600px] mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl md:text-3xl font-bold text-foreground tracking-tight">Extrato</h1>
          <p className="mt-1 text-xs md:text-sm text-muted-foreground">
            Histórico de até 12 meses. Toque em uma transação para ver detalhes.
          </p>
        </div>
        <Button variant="outline" size="sm" className="hidden md:inline-flex">
          <Download className="h-4 w-4 mr-2" /> Exportar
        </Button>
      </div>

      {/* Seletor de período + resumo */}
      <div className="space-y-3 md:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <PeriodFilter months={months} value={period} onChange={handlePeriodChange} />
        </div>
        <MonthSummaryCard
          count={filteredTotals.count}
          entradas={filteredTotals.entradas}
          saidas={filteredTotals.saidas}
        />
      </div>

      {/* Filtros (busca + conta + categoria) */}
      <Card className="bg-gradient-card border-border p-3 md:p-4">
        <div className="flex flex-col md:flex-row gap-2 md:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descrição..."
              className="pl-9 bg-input border-border h-9 md:h-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={flow} onValueChange={(v) => setFlow(v as "all" | "entrada" | "saida")}>
              <SelectTrigger className="flex-1 md:w-40 bg-input border-border h-9 md:h-10">
                <SelectValue placeholder="Fluxo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Entradas e saídas</SelectItem>
                <SelectItem value="entrada">Apenas entradas</SelectItem>
                <SelectItem value="saida">Apenas saídas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger className="flex-1 md:w-48 bg-input border-border h-9 md:h-10">
                <SelectValue placeholder="Conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accountOptions.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="flex-1 md:w-48 bg-input border-border h-9 md:h-10">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {parentCategories.map((c) => (
                  <SelectItem key={c.id} value={c.label}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Lista de transações */}
      <Card className="bg-gradient-card border-border overflow-hidden">
        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-10 md:p-12 text-center text-sm text-muted-foreground">
              Nenhuma transação para este mês com os filtros aplicados.
            </div>
          ) : (
            visible.map((t) => (
              <TransactionRow
                key={t.id}
                tx={t}
                parentCategories={parentCategories}
                onChangeCategory={handleChangeCategory}
                accountLogoUrl={accountLogoByName.get(t.account) ?? null}
              />
            ))
          )}
        </div>
        {filtered.length > visible.length && (
          <div className="p-3 border-t border-border flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVisibleCount((c) => c + PAGE_INCREMENT)}
            >
              Carregar mais ({filtered.length - visible.length} restantes)
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Extrato;
