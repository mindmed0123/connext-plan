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
  Users,
  DollarSign,
  Shield,
  CreditCard,
  Wrench,
  Settings,
} from "lucide-react";
import iconLogo from "@/assets/icon.png";
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
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, modulo: "dashboard" },
  { title: "Obras", url: "/obras", icon: HardHat, modulo: "obras" },
  { title: "Etapas", url: "/etapas", icon: Columns3, modulo: "etapas" },
];

const modulosAdmin: NavItem[] = [
  { title: "Vistorias", url: "/vistorias", icon: ClipboardList, modulo: "vistorias" },
  { title: "Orçamentos", url: "/orcamentos", icon: FileText, modulo: "orcamentos" },
  { title: "Serviços", url: "/servicos", icon: Wrench, modulo: "servicos" },
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
  const { signOut, user, empresaNome } = useAuth();
  const { isAdmin, isSuperAdmin, isLoading } = useUserRole();
  const { can, isLoading: permLoading } = usePermissions();

  // super_admin/admin/gestor veem tudo. Administrativo "comum" filtra por permissão.
  const filtra = (items: NavItem[]) =>
    isSuperAdmin || isAdmin ? items : items.filter((i) => can(i.modulo, "view"));

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
          <img
            src={iconLogo}
            alt="Gestão de Obra"
            className="h-8 w-8 rounded-md object-contain"
          />
          {!collapsed && (
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="text-sm font-semibold truncate">{empresaNome ?? "Gestão de Obra"}</span>
              <span className="text-[11px] text-muted-foreground truncate">
                {empresaNome ? "Gestão de Obra" : "Gestão para construtoras"}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {isLoading || permLoading ? null : (isAdmin || isSuperAdmin) ? (
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

            <SidebarGroup>
              <SidebarGroupLabel>Conta</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.pathname.startsWith("/billing")}>
                      <NavLink to="/billing">
                        <CreditCard className="h-4 w-4" />
                        {!collapsed && <span>Assinatura</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isSuperAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>Sistema</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin")}>
                        <NavLink to="/admin">
                          <Shield className="h-4 w-4" />
                          {!collapsed && <span>Admin</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        ) : (
          <>
            {/* Itens liberados via permissões (administrativos com escopo restrito) */}
            {filtra([...operacionalAdmin, ...modulosAdmin, ...financeiroAdmin, ...gestaoAdmin]).length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Liberado para você</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {renderItems(filtra([...operacionalAdmin, ...modulosAdmin, ...financeiroAdmin, ...gestaoAdmin]))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
            {/* Sempre mostra "Minhas obras" para operacional/terceirizado */}
            <SidebarGroup>
              <SidebarGroupLabel>Minha área</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{renderItems(operacionalRestrito)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
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
