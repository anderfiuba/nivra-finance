import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Wallet, FileText, CreditCard, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tab bar inferior para mobile (estilo apps fintech). Mostra 5 itens
 * principais; demais entradas (Ciclo, Conexões, Configurações, Planos)
 * ficam no item "Mais" via Sheet/menu.
 */
const items = [
  { title: "Início", url: "/app", icon: LayoutDashboard, end: true },
  { title: "Contas", url: "/app/contas", icon: Wallet },
  { title: "Extrato", url: "/app/extrato", icon: FileText },
  { title: "Faturas", url: "/app/faturas", icon: CreditCard },
  { title: "Mais", url: "/app/configuracoes", icon: Menu },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  const isActive = (url: string, end?: boolean) =>
    end ? pathname === url : pathname.startsWith(url);

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação principal"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(item.url, "end" in item ? item.end : false);
          return (
            <li key={item.title}>
              <NavLink
                to={item.url}
                end={"end" in item ? item.end : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] tracking-tight transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary"
                  />
                )}
                <item.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.5} />
                <span className={cn(active && "font-medium")}>{item.title}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
