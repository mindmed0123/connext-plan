import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  HardHat,
  Columns3,
  Camera,
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
  Bell,
  ShoppingCart,
  Package,
  TrendingUp,
  FileSignature,
  Ruler,
  Truck,
  Landmark,
  Layers,
  CalendarRange,
  Sparkles,
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
import { useModulos } from "@/hooks/useModulos";
import { ModuloChave } from "@/lib/modulos";

type NavItem = { title: string; url: string; icon: any; modulo: AppModulo; mod?: ModuloChave };

const operacionalAdmin: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, modulo: "dashboard" },
  { title: "Minhas aprovações", url: "/aprovacoes", icon: ClipboardList, modulo: "dashboard" },
  { title: "Obras", url: "/obras", icon: HardHat, modulo: "obras", mod: "obras" },
  { title: "Etapas", url: "/etapas", icon: Columns3, modulo: "etapas", mod: "etapas" },
  { title: "Diário de obra", url: "/campo/rdo", icon: ClipboardList, modulo: "diario", mod: "diario" },
];

const modulosAdmin: NavItem[] = [
  { title: "Vistorias", url: "/vistorias", icon: ClipboardList, modulo: "vistorias", mod: "vistorias" },
  { title: "Orçamentos", url: "/orcamentos", icon: FileText, modulo: "orcamentos", mod: "orcamentos" },
  { title: "Serviços", url: "/servicos", icon: Wrench, modulo: "servicos", mod: "servicos" },
  { title: "Execuções", url: "/execucoes", icon: Hammer, modulo: "execucoes", mod: "execucoes" },
];

const financeiroAdmin: NavItem[] = [
  { title: "Financeiro", url: "/financeiro", icon: DollarSign, modulo: "financeiro" },
  { title: "Contratos", url: "/contratos", icon: FileSignature, modulo: "contratos", mod: "contratos" },
  { title: "Medições", url: "/medicoes", icon: Ruler, modulo: "medicoes", mod: "medicoes" },
  { title: "Faturamento", url: "/faturamento", icon: Receipt, modulo: "faturamento", mod: "faturamento" },
  { title: "Recebimentos", url: "/recebimentos", icon: Wallet, modulo: "financeiro", mod: "recebimentos" },
  { title: "Contas a pagar", url: "/contas-pagar", icon: Truck, modulo: "financeiro", mod: "contas_pagar" },
  { title: "Bancos", url: "/bancos", icon: Landmark, modulo: "financeiro", mod: "bancos" },
  { title: "Cartões", url: "/cartoes", icon: CreditCard, modulo: "financeiro", mod: "cartoes" },
  { title: "Compras", url: "/compras", icon: ShoppingCart, modulo: "financeiro", mod: "compras" },
  { title: "Estoque", url: "/estoque", icon: Package, modulo: "financeiro", mod: "estoque" },
  { title: "Insumos", url: "/insumos", icon: Package, modulo: "orcamentos", mod: "orcamento_composicoes" },
  { title: "Composições", url: "/composicoes", icon: Layers, modulo: "orcamentos", mod: "orcamento_composicoes" },
  { title: "Cronograma", url: "/cronograma", icon: CalendarRange, modulo: "etapas", mod: "cronograma" },
  { title: "Desempenho", url: "/desempenho", icon: TrendingUp, modulo: "dashboard" },
  { title: "Compradores", url: "/compradores", icon: ShoppingCart, modulo: "financeiro", mod: "compras" },
];

const gestaoAdmin: NavItem[] = [
  { title: "Equipes", url: "/equipes", icon: Users, modulo: "equipes", mod: "equipes" },
];

// Operacional / terceirizado: apenas obras vinculadas
const operacionalRestrito: NavItem[] = [
  { title: "Minhas obras", url: "/obras", icon: HardHat, modulo: "obras", mod: "obras" },
  { title: "Canteiro", url: "/campo", icon: Camera, modulo: "obras", mod: "obras" },
  { title: "Diário de obra", url: "/campo/rdo", icon: ClipboardList, modulo: "diario", mod: "diario" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user, empresaNome } = useAuth();
  const { isAdmin, isSuperAdmin, isLoading } = useUserRole();
  const { can, isLoading: permLoading } = usePermissions();
  const { moduloAtivo, isLoading: modLoading } = useModulos();

  // admin/gestor veem tudo na própria empresa. Super admin vê somente o painel do sistema.
  // Módulo desligado some do menu, para ninguém abrir tela vazia.
  const ligado = (i: NavItem) => (i.mod ? moduloAtivo(i.mod) : true);
  const filtra = (items: NavItem[]) =>
    (isAdmin ? items : items.filter((i) => can(i.modulo, "view"))).filter(ligado);

  const renderItems = (items: NavItem[]) =>
    items.filter(ligado).map((item) => {
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
        {isLoading || permLoading || modLoading ? null : isSuperAdmin ? (
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
        ) : isAdmin ? (
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
                    <SidebarMenuButton asChild isActive={location.pathname.startsWith("/configuracoes")}>
                      <NavLink to="/configuracoes">
                        <Settings className="h-4 w-4" />
                        {!collapsed && <span>Configurações</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.pathname.startsWith("/notificacoes")}>
                      <NavLink to="/notificacoes">
                        <Bell className="h-4 w-4" />
                        {!collapsed && <span>Avisos</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.pathname.startsWith("/billing")}>
                      <NavLink to="/billing">
                        <CreditCard className="h-4 w-4" />
                        {!collapsed && <span>Assinatura</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.pathname.startsWith("/acessos-suporte")}>
                      <NavLink to="/acessos-suporte">
                        <Shield className="h-4 w-4" />
                        {!collapsed && <span>Acessos do suporte</span>}
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
