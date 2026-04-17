import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  HardHat,
  Columns3,
  ClipboardList,
  FileText,
  Hammer,
  Receipt,
  Wallet,
  LogOut,
  Building2,
  Users,
  DollarSign,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { AppModulo, usePermissions } from "@/hooks/usePermissions";

type NavItem = { title: string; url: string; icon: any; modulo: AppModulo };

const operacionalAdmin: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, modulo: "dashboard" },
  { title: "Obras", url: "/obras", icon: HardHat, modulo: "obras" },
  { title: "Etapas", url: "/etapas", icon: Columns3, modulo: "etapas" },
];

const modulosAdmin: NavItem[] = [
  { title: "Vistorias", url: "/vistorias", icon: ClipboardList, modulo: "vistorias" },
  { title: "Orçamentos", url: "/orcamentos", icon: FileText, modulo: "orcamentos" },
  { title: "Execuções", url: "/execucoes", icon: Hammer, modulo: "execucoes" },
];

const financeiroAdmin: NavItem[] = [
  { title: "Financeiro", url: "/financeiro", icon: DollarSign, modulo: "financeiro" },
  { title: "Faturamento", url: "/faturamento", icon: Receipt, modulo: "faturamento" },
  { title: "Recebimentos", url: "/recebimentos", icon: Wallet, modulo: "financeiro" },
];

const gestaoAdmin: NavItem[] = [
  { title: "Equipes", url: "/equipes", icon: Users, modulo: "equipes" },
];

// Operacional / terceirizado: apenas obras vinculadas
const operacionalRestrito: NavItem[] = [
  { title: "Minhas obras", url: "/obras", icon: HardHat, modulo: "obras" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin, isLoading } = useUserRole();

  const renderItems = (items: NavItem[]) =>
    items.map((item) => {
      const active = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild isActive={active}>
            <NavLink to={item.url} end={item.url === "/"}>
              <item.icon className="h-4 w-4" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">ObraFlow</span>
              <span className="text-[11px] text-muted-foreground">ERP de Obras</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {isLoading ? null : isAdmin ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Operacional</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{renderItems(operacionalAdmin)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Módulos</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{renderItems(modulosAdmin)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Financeiro</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{renderItems(financeiroAdmin)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Gestão</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{renderItems(gestaoAdmin)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Minha área</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(operacionalRestrito)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        {!collapsed && user && (
          <div className="px-2 pb-2">
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start">
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Sair"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
