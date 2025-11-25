import { LayoutDashboard, Users, Package, UserCheck, FileText, Calculator, FileCheck, Receipt, Wallet, GitBranch, BarChart3, Shield, Briefcase, CheckSquare } from 'lucide-react';
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

const financeItems = [
  { title: 'Dashboard', url: '/dashboard-mensual', icon: LayoutDashboard },
  { title: 'Contratos', url: '/contratos', icon: FileText },
  { title: 'Presupuestos', url: '/presupuestos', icon: Calculator },
  { title: 'Requests Financieros', url: '/solicitudes', icon: FileCheck },
  { title: 'Facturas', url: '/facturas', icon: Receipt },
  { title: 'Liquidaciones', url: '/liquidaciones', icon: Wallet },
  { title: 'Mis Liquidaciones', url: '/mis-liquidaciones', icon: Wallet },
  { title: 'Flujo Requests', url: '/flujo-requests', icon: GitBranch },
  { title: 'Reportes', url: '/reportes', icon: BarChart3 },
];

const operationsItems = [
  { title: 'Proyectos', url: '/proyectos-operativos', icon: Briefcase },
  { title: 'Mis Tareas', url: '/mis-tareas', icon: CheckSquare },
];

const adminItems = [
  { title: 'Clientes', url: '/clientes', icon: Users },
  { title: 'Servicios', url: '/servicios', icon: Package },
  { title: 'Especialistas', url: '/especialistas', icon: UserCheck },
  { title: 'Usuarios', url: '/usuarios', icon: Shield },
];

export function AppSidebar() {
  const { state } = useSidebar();

  return (
    <Sidebar collapsible="icon" className={state === 'collapsed' ? 'w-14' : 'w-60'}>
      <SidebarContent>
        {/* Finance Layer */}
        <SidebarGroup>
          <SidebarGroupLabel>Finance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financeItems.map((item) => (
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

        {/* Operations Layer */}
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsItems.map((item) => (
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

        {/* Admin */}
        <SidebarGroup>
          <SidebarGroupLabel>Administración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
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
      </SidebarContent>
    </Sidebar>
  );
}
