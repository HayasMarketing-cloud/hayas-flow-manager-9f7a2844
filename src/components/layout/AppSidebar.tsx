import { LayoutDashboard, Users, Package, UserCheck, FileText, Calculator, FileCheck, Receipt, Wallet, BarChart3, Shield, Briefcase, CheckSquare, DollarSign, Bell } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useUserRole } from '@/hooks/useUserRole';
import flowManagerLogo from '@/assets/flowmanager-logo.png';
import flowManagerIsotype from '@/assets/flowmanager-isotype.png';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRoles?: string[];
}

const operationsItems: NavItem[] = [
  { title: 'Requests', url: '/solicitudes', icon: FileCheck, requiredRoles: ['admin', 'finanzas', 'project_manager', 'account_manager', 'especialista'] },
  { title: 'Presupuestos', url: '/presupuestos', icon: Calculator },
  { title: 'Proyectos', url: '/proyectos-operativos', icon: Briefcase, requiredRoles: ['admin', 'project_manager', 'especialista', 'account_manager'] },
  { title: 'Mis Tareas', url: '/mis-tareas', icon: CheckSquare, requiredRoles: ['admin', 'project_manager', 'account_manager', 'especialista'] },
  { title: 'Notificaciones', url: '/notificaciones', icon: Bell },
];

const financeItems: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard-mensual', icon: LayoutDashboard },
  { title: 'Contratos', url: '/contratos', icon: FileText },
  { title: 'Facturas', url: '/facturas', icon: Receipt, requiredRoles: ['admin', 'finanzas', 'account_manager'] },
  { title: 'Liquidaciones', url: '/liquidaciones', icon: Wallet, requiredRoles: ['admin', 'finanzas', 'account_manager', 'especialista'] },
  { title: 'Comisiones', url: '/comisiones', icon: DollarSign, requiredRoles: ['admin', 'finanzas'] },
  { title: 'Reportes', url: '/reportes', icon: BarChart3, requiredRoles: ['admin', 'finanzas'] },
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
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        <img 
          src={state === 'collapsed' ? flowManagerIsotype : flowManagerLogo} 
          alt="Flow Manager" 
          className={
            state === 'collapsed'
              ? 'h-10 w-10 object-contain brightness-0 invert mx-auto'
              : 'h-16 w-auto object-contain brightness-0 invert mx-auto'
          }
        />
      </SidebarHeader>
      <SidebarContent>
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
                        className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
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
                        className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
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
                        className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
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
