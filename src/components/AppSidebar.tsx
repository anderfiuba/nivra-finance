import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Wallet, FileText, Plug, Settings, Crown, LogOut, Tags, CreditCard } from "lucide-react";
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
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, end: true, plus: false },
  { title: "Contas", url: "/app/contas", icon: Wallet, plus: false },
  { title: "Extrato Unificado", url: "/app/extrato", icon: FileText, plus: false },
  { title: "Faturas", url: "/app/faturas", icon: CreditCard, plus: true },
  { title: "Ciclo Financeiro", url: "/app/categorizacao", icon: Tags, plus: true },
  { title: "Conexões Open Finance", url: "/app/conexoes", icon: Plug, plus: false },
  { title: "Configurações", url: "/app/configuracoes", icon: Settings, plus: false },
  { title: "Planos", url: "/app/planos", icon: Crown, plus: false },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { displayName, user, signOut } = useAuth();
  const { isPlus } = useSubscription();

  const handleSignOut = async () => {
    await signOut();
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("nivra:"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* noop */
    }
    navigate("/login", { replace: true });
  };

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
                        {!collapsed && (
                          <span className="text-sm flex-1 flex items-center gap-2">
                            {item.title}
                            {item.plus && !isPlus && (
                              <Badge
                                variant="outline"
                                className="border-primary/40 text-primary bg-primary/10 text-[10px] px-1.5 py-0 h-4"
                              >
                                Plus
                              </Badge>
                            )}
                          </span>
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
                {displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email ?? "Conta autenticada"}</p>
              </div>
            </div>
          </div>
        )}
        <SidebarMenuButton
          onClick={handleSignOut}
          className="text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="text-sm">Sair</span>}
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
