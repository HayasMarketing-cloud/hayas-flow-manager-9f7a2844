import { LayoutDashboard, Users, Package, UserCheck, FileText, Calculator, FileCheck, Receipt, Wallet, GitBranch, BarChart3, Shield, Briefcase, CheckSquare, DollarSign } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useUserRole } from '@/hooks/useUserRole';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRoles?: string[];
}

const financeItems: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard-mensual', icon: LayoutDashboard },
  { title: 'Contratos', url: '/contratos', icon: FileText },
  { title: 'Presupuestos', url: '/presupuestos', icon: Calculator },
  { title: 'Requests Financieros', url: '/solicitudes', icon: FileCheck, requiredRoles: ['admin', 'finanzas', 'project_manager', 'account_manager'] },
  { title: 'Facturas', url: '/facturas', icon: Receipt, requiredRoles: ['admin', 'finanzas', 'account_manager'] },
  { title: 'Liquidaciones', url: '/liquidaciones', icon: Wallet, requiredRoles: ['admin', 'finanzas', 'account_manager'] },
  { title: 'Comisiones', url: '/comisiones', icon: DollarSign, requiredRoles: ['admin', 'finanzas'] },
  { title: 'Mis Liquidaciones', url: '/mis-liquidaciones', icon: Wallet, requiredRoles: ['especialista'] },
  { title: 'Flujo Requests', url: '/flujo-requests', icon: GitBranch, requiredRoles: ['admin', 'finanzas', 'project_manager'] },
  { title: 'Reportes', url: '/reportes', icon: BarChart3, requiredRoles: ['admin', 'finanzas'] },
];

const operationsItems: NavItem[] = [
  { title: 'Proyectos', url: '/proyectos-operativos', icon: Briefcase, requiredRoles: ['admin', 'project_manager', 'especialista', 'account_manager'] },
  { title: 'Mis Tareas', url: '/mis-tareas', icon: CheckSquare },
];

const adminItems: NavItem[] = [
  { title: 'Clientes', url: '/clientes', icon: Users },
  { title: 'Servicios', url: '/servicios', icon: Package },
  { title: 'Especialistas', url: '/especialistas', icon: UserCheck },
  { title: 'Usuarios', url: '/usuarios', icon: Shield, requiredRoles: ['admin'] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { roles, hasRole, loading } = useUserRole();

  const canViewItem = (item: NavItem): boolean => {
    if (!item.requiredRoles || item.requiredRoles.length === 0) {
      return true;
    }
    return item.requiredRoles.some(role => hasRole(role as any));
  };

  const visibleFinanceItems = financeItems.filter(canViewItem);
  const visibleOperationsItems = operationsItems.filter(canViewItem);
  const visibleAdminItems = adminItems.filter(canViewItem);

  if (loading) {
    return (
      <Sidebar collapsible="icon" className={state === 'collapsed' ? 'w-14' : 'w-60'}>
        <SidebarContent>
          <div className="p-4 text-muted-foreground text-sm">Cargando...</div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon" className={state === 'collapsed' ? 'w-14' : 'w-60'}>
      <SidebarContent>
        {/* Finance Layer */}
        {visibleFinanceItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Finance</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleFinanceItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-muted/50"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        {state !== 'collapsed' && <span className="ml-2">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Operations Layer */}
        {visibleOperationsItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Operations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleOperationsItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-muted/50"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        {state !== 'collapsed' && <span className="ml-2">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Admin */}
        {visibleAdminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-muted/50"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        {state !== 'collapsed' && <span className="ml-2">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
