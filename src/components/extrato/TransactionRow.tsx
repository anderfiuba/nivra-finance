import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/data/mockData";

interface ParentCategoryOption {
  id: string;
  label: string;
}

interface TransactionRowProps {
  tx: Transaction;
  parentCategories: ParentCategoryOption[];
  onChangeCategory: (id: string, label: string) => void;
}

const WEEKDAY_TIME = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
};

const FULL_DATE = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Linha de transação com layout responsivo:
 * - Mobile: card compacto, clicável, expande detalhes inline (categoria editável,
 *   conta completa, status, parcela, valor original).
 * - Desktop: linha tradicional com select de categoria visível.
 */
export function TransactionRow({ tx, parentCategories, onChangeCategory }: TransactionRowProps) {
  const [open, setOpen] = useState(false);
  const isEntrada = tx.type === "entrada";
  const sign = isEntrada ? "+" : "−";
  const valueColor = isEntrada ? "text-success" : "text-destructive";
  const iconBg = isEntrada ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive";

  const categoryLabel = tx.category || "Sem categoria";
  const accountTag = tx.accountTag || tx.operationType || null;
  const installments =
    tx.installmentNumber && tx.totalInstallments && tx.totalInstallments > 1
      ? `${tx.installmentNumber}/${tx.totalInstallments}`
      : null;

  return (
    <div className="md:contents">
      {/* Mobile (< md): card compacto clicável */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="md:hidden w-full text-left flex items-center gap-3 p-3 hover:bg-secondary/30 transition-smooth"
        aria-expanded={open}
      >
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
          {isEntrada ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {categoryLabel}
            {accountTag ? <span className="text-muted-foreground/70"> · {accountTag}</span> : null}
          </p>
        </div>
        <div className="text-right shrink-0 flex items-start gap-1">
          <div>
            <p className={cn("text-sm font-semibold tabular-nums", valueColor)}>
              {sign}
              {formatBRL(tx.value)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{WEEKDAY_TIME(tx.date)}</p>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground mt-0.5 transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {/* Mobile: detalhes expansíveis */}
      {open && (
        <div className="md:hidden px-3 pb-4 pt-1 bg-secondary/20 border-t border-border/50 space-y-3">
          <DetailRow label="Conta">
            <span className="text-foreground">{tx.account}</span>
          </DetailRow>
          <DetailRow label="Data">
            <span className="text-foreground capitalize">{FULL_DATE(tx.date)}</span>
          </DetailRow>
          {installments && (
            <DetailRow label="Parcela">
              <Badge variant="secondary" className="font-normal">{installments}</Badge>
            </DetailRow>
          )}
          {tx.merchantName && (
            <DetailRow label="Estabelecimento">
              <span className="text-foreground">{tx.merchantName}</span>
            </DetailRow>
          )}
          {tx.status && (
            <DetailRow label="Status">
              <Badge
                variant="outline"
                className={cn(
                  "font-normal text-[10px]",
                  tx.status === "POSTED" ? "border-success/40 text-success" : "border-amber-500/40 text-amber-500",
                )}
              >
                {tx.status === "POSTED" ? "Confirmada" : "Pendente"}
              </Badge>
            </DetailRow>
          )}
          {tx.originalCurrency && tx.originalAmount !== undefined && (
            <DetailRow label="Valor original">
              <span className="text-foreground tabular-nums">
                {Math.abs(tx.originalAmount).toFixed(2)} {tx.originalCurrency}
              </span>
            </DetailRow>
          )}
          <DetailRow label="Categoria">
            <Select value={tx.category || ""} onValueChange={(v) => onChangeCategory(tx.id, v)}>
              <SelectTrigger className="h-8 px-2 text-xs flex-1 bg-input border-border" aria-label="Categoria da transação">
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {parentCategories.length === 0 ? (
                  <SelectItem value="__none" disabled>Carregando…</SelectItem>
                ) : (
                  parentCategories.map((it) => (
                    <SelectItem key={it.id} value={it.label}>{it.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </DetailRow>
        </div>
      )}

      {/* Desktop (≥ md): layout tabular */}
      <div className="hidden md:flex items-center gap-4 p-4 hover:bg-secondary/30 transition-smooth">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
          {isEntrada ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <Select value={tx.category || ""} onValueChange={(v) => onChangeCategory(tx.id, v)}>
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
            <span className="text-xs text-muted-foreground truncate">{tx.account}</span>
            {installments && (
              <Badge variant="secondary" className="font-normal text-[10px]">{installments}</Badge>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={cn("text-sm font-semibold tabular-nums", valueColor)}>
            {sign}
            {formatBRL(tx.value)}
          </p>
          {tx.originalCurrency && tx.originalAmount !== undefined && (
            <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
              {Math.abs(tx.originalAmount).toFixed(2)} {tx.originalCurrency}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{WEEKDAY_TIME(tx.date)}</p>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="text-xs flex items-center gap-2 min-w-0 flex-1 justify-end">{children}</div>
    </div>
  );
}