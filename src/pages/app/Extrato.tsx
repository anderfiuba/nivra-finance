import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { transactions } from "@/data/mockData";
import { formatBRL, formatDate } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, Download, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";

const Extrato = () => {
  const [search, setSearch] = useState("");
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (account !== "all" && t.account !== account) return false;
      if (category !== "all" && t.category !== category) return false;
      return true;
    });
  }, [search, account, category]);

  const accounts = Array.from(new Set(transactions.map((t) => t.account)));
  const categories = Array.from(new Set(transactions.map((t) => t.category)));

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Extrato Unificado</h1>
          <p className="mt-1 text-sm text-muted-foreground">Todas as movimentações de todas as contas em uma única visão.</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" /> Exportar
        </Button>
      </div>

      <Card className="bg-gradient-card border-border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por descrição..." className="pl-9 bg-input border-border h-10" />
          </div>
          <Select value={account} onValueChange={setAccount}>
            <SelectTrigger className="w-full lg:w-48 bg-input border-border"><SelectValue placeholder="Conta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accounts.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full lg:w-48 bg-input border-border"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="shrink-0"><Filter className="h-4 w-4" /></Button>
        </div>
      </Card>

      <Card className="bg-gradient-card border-border overflow-hidden">
        <div className="divide-y divide-border">
          {filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">Nenhuma transação encontrada com os filtros aplicados.</div>
          )}
          {filtered.map((t) => (
            <div key={t.id} className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-smooth">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${t.type === "entrada" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {t.type === "entrada" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs h-5 border-border bg-secondary/50">{t.category}</Badge>
                  <span className="text-xs text-muted-foreground">{t.account}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-semibold ${t.type === "entrada" ? "text-success" : "text-foreground"}`}>
                  {t.value > 0 ? "+" : ""}{formatBRL(t.value)}
                </p>
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
