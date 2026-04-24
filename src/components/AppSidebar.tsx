import { LayoutDashboard, Wallet, FileText, Plug, Settings, Crown, LogOut, ListChecks } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useFinance } from "@/contexts/FinanceContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, end: true },
  { title: "Contas", url: "/app/contas", icon: Wallet },
  { title: "Extrato Unificado", url: "/app/extrato", icon: FileText },
  { title: "Categorização Pendente", url: "/app/categorizacao", icon: ListChecks, badgeKey: "pending" as const },
  { title: "Conexões Open Finance", url: "/app/conexoes", icon: Plug },
  { title: "Configurações", url: "/app/configuracoes", icon: Settings },
  { title: "Planos", url: "/app/planos", icon: Crown },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { pendingList } = useFinance();
  const pendingCount = pendingList.length;

  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Logo showText={!collapsed} />
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url, item.end);
                const showBadge = item.badgeKey === "pending" && pendingCount > 0;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className="h-10">
                      <NavLink
                        to={item.url}
                        end={item.end}
                        className={`flex items-center gap-3 rounded-lg px-3 transition-smooth ${
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
                        {!collapsed && <span className="text-sm flex-1">{item.title}</span>}
                        {!collapsed && showBadge && (
                          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground">
                            {pendingCount}
                          </span>
                        )}
                        {collapsed && showBadge && (
                          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="mb-3 rounded-lg bg-sidebar-accent/40 p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                R
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-accent-foreground truncate">Rafael Silva</p>
                <p className="text-xs text-muted-foreground truncate">Plano Plus</p>
              </div>
            </div>
          </div>
        )}
        <SidebarMenuButton
          onClick={() => navigate("/login")}
          className="text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="text-sm">Sair</span>}
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
