import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Briefcase, Edit, Trash2, Eye, MoreVertical, LayoutGrid, List, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useOperationalProjects, useDeleteOperationalProject } from '@/hooks/useOperationalProjects';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OperationalProjectFormModal } from '@/components/operations/OperationalProjectFormModal';
import { HierarchicalTrackingTable } from '@/components/operations/HierarchicalTrackingTable';
import { DebugAccessPanel } from '@/components/operations/DebugAccessPanel';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import GoogleDriveIcon from '@/assets/icons8-google-drive.svg';
import { useAssignedClients } from '@/hooks/useAssignedClients';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';

const statusColors = {
  pending: 'bg-yellow-500',
  in_progress: 'bg-blue-500',
  in_review: 'bg-purple-500',
  completed: 'bg-green-500',
};

const statusLabels = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  in_review: 'En Revisión',
  completed: 'Completado',
};

export default function OperationalProjects() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAccountManager, isProjectManager, isAdmin, canAccessFinance } = useUserRole();
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('not_completed');
  const [specialistFilter, setSpecialistFilter] = useState<string>('all');
  const [amFilter, setAmFilter] = useState<string>('all');
  const [pmFilter, setPmFilter] = useState<string>('all');
  const [amPmInitialized, setAmPmInitialized] = useState(false);
  const [budgetFilter, setBudgetFilter] = useState<string>('all');
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'tracking'>('cards');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<any>(null);

  const { assignedClientIds, isLoading: assignedLoading, needsFiltering } = useAssignedClients();

  // Pre-select AM/PM filter for AM/PM users without elevated roles
  useEffect(() => {
    if (amPmInitialized || !user) return;
    const hasElevated = isAdmin() || canAccessFinance();
    if (!hasElevated && isAccountManager()) {
      setAmFilter(user.id);
      setAmPmInitialized(true);
    } else if (!hasElevated && isProjectManager()) {
      setPmFilter(user.id);
      setAmPmInitialized(true);
    } else {
      setAmPmInitialized(true);
    }
  }, [user, isAdmin, canAccessFinance, isAccountManager, isProjectManager, amPmInitialized]);

  const { data: projects, isLoading, error: projectsError } = useOperationalProjects({
    clientId: clientFilter === 'all' ? undefined : clientFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    searchTerm: searchTerm || undefined,
    assignedClientIds: needsFiltering ? assignedClientIds : undefined,
    needsFiltering,
    amUserId: amFilter === 'all' ? undefined : amFilter,
    pmUserId: pmFilter === 'all' ? undefined : pmFilter,
    enabled: !assignedLoading,
  });

  const deleteMutation = useDeleteOperationalProject();

  const { data: clients } = useQuery({
    queryKey: ['clients-active', needsFiltering, assignedClientIds],
    queryFn: async () => {
      // For AM/PM, only show assigned clients
      if (needsFiltering && assignedClientIds.length > 0) {
        const { data, error } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', assignedClientIds)
          .eq('status', 'active')
          .order('name');
        if (error) throw error;
        return data;
      }
      
      // AM/PM with no assignments
      if (needsFiltering && assignedClientIds.length === 0) {
        return [];
      }
      
      // Default: all clients for admin/finanzas
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !assignedLoading,
  });

  // Fetch request stats for all projects (counts + progress)
  const { data: requestStats } = useQuery({
    queryKey: ['operational-request-stats', projects?.map(p => p.id)],
    queryFn: async () => {
      if (!projects || projects.length === 0) return {};
      const { data, error } = await supabase
        .from('operational_requests')
        .select('id, operational_project_id, status')
        .in('operational_project_id', projects.map(p => p.id));
      if (error) throw error;
      
      const stats: Record<string, { total: number; completed: number }> = {};
      data?.forEach(r => {
        if (!stats[r.operational_project_id]) {
          stats[r.operational_project_id] = { total: 0, completed: 0 };
        }
        stats[r.operational_project_id].total++;
        if (r.status === 'completed') {
          stats[r.operational_project_id].completed++;
        }
      });
      return stats;
    },
    enabled: !!projects && projects.length > 0,
  });

  const hasActiveFilters = !!(
    searchTerm || 
    clientFilter !== 'all' || 
    (statusFilter !== 'all' && statusFilter !== 'not_completed') || 
    specialistFilter !== 'all' ||
    amFilter !== 'all' ||
    pmFilter !== 'all' ||
    budgetFilter !== 'all' ||
    contractFilter !== 'all'
  );

  // Budgets for the selected client (for tracking tab filter)
  const { data: clientBudgets } = useQuery({
    queryKey: ['client-budgets-filter', clientFilter],
    queryFn: async () => {
      if (clientFilter === 'all') return [];
      const { data, error } = await supabase
        .from('budgets')
        .select('id, title, code')
        .eq('client_id', clientFilter)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: clientFilter !== 'all',
  });

  // Contracts for the selected client (for tracking tab filter)
  const { data: clientContracts } = useQuery({
    queryKey: ['client-contracts-filter', clientFilter],
    queryFn: async () => {
      if (clientFilter === 'all') return [];
      const { data, error } = await supabase
        .from('contracts')
        .select('id, title, code')
        .eq('client_id', clientFilter)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: clientFilter !== 'all',
  });

  // Handler for client change - reset dependent filters
  const handleClientChange = (value: string) => {
    setClientFilter(value);
    setBudgetFilter('all');
    setContractFilter('all');
  };

  // Build filter object for tracking view
  const trackingFilters = {
    clientId: clientFilter === 'all' ? undefined : clientFilter,
    specialistId: specialistFilter === 'all' ? undefined : specialistFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    budgetId: budgetFilter === 'all' ? undefined : budgetFilter,
    contractId: contractFilter === 'all' ? undefined : contractFilter,
    searchTerm: searchTerm || undefined,
  };

  // Fetch specialists for filter
  const { data: specialists } = useQuery({
    queryKey: ['specialists-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch AM/PM users for filters
  const { data: amPmUsers } = useQuery({
    queryKey: ['am-pm-users'],
    queryFn: async () => {
      // Get all user IDs that appear as AM or PM in contracts or budgets
      const [contractsRes, budgetsRes] = await Promise.all([
        supabase.from('contracts').select('am_user_id, pm_user_id'),
        supabase.from('budgets').select('am_user_id, pm_user_id'),
      ]);
      
      const amIds = new Set<string>();
      const pmIds = new Set<string>();
      
      [...(contractsRes.data || []), ...(budgetsRes.data || [])].forEach((row: any) => {
        if (row.am_user_id) amIds.add(row.am_user_id);
        if (row.pm_user_id) pmIds.add(row.pm_user_id);
      });
      
      const allIds = [...new Set([...amIds, ...pmIds])];
      if (allIds.length === 0) return { ams: [], pms: [] };
      
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', allIds)
        .order('full_name');
      if (error) throw error;
      
      return {
        ams: (profiles || []).filter(p => amIds.has(p.id)),
        pms: (profiles || []).filter(p => pmIds.has(p.id)),
      };
    },
  });

  const handleCreate = () => {
    setSelectedProject(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEdit = (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProject(project);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleDelete = (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (projectToDelete) {
      await deleteMutation.mutateAsync(projectToDelete.id);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const handleViewDetail = (projectId: string) => {
    navigate(`/operaciones/proyectos/${projectId}`);
  };

  return (
    <AppLayout 
      title="Proyectos Operativos" 
      description="Gestión de proyectos operativos por cliente"
    >
      <div className="space-y-6">
        {/* Debug Panel - only visible with ?debug=1 */}
        <DebugAccessPanel />

        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Proyectos Operativos</h2>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Proyecto
          </Button>
        </div>

        {/* Filters */}
        <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={activeTab === 'cards' ? "Buscar proyectos..." : "Buscar milestones..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={clientFilter} onValueChange={handleClientChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_completed">Activos (sin completados)</SelectItem>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="in_progress">En Progreso</SelectItem>
                    <SelectItem value="in_review">En Revisión</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={amFilter} onValueChange={setAmFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los AM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los AM</SelectItem>
                    {amPmUsers?.ams?.map((am) => (
                      <SelectItem key={am.id} value={am.id}>
                        {am.full_name || am.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={pmFilter} onValueChange={setPmFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los PM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los PM</SelectItem>
                    {amPmUsers?.pms?.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.full_name || pm.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {activeTab === 'tracking' && (
                  <>
                    <Select value={specialistFilter} onValueChange={setSpecialistFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los especialistas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los especialistas</SelectItem>
                        {specialists?.map((specialist) => (
                          <SelectItem key={specialist.id} value={specialist.id}>
                            {specialist.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {clientFilter !== 'all' && (
                      <>
                        <Select value={budgetFilter} onValueChange={setBudgetFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="Todos los presupuestos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los presupuestos</SelectItem>
                            {clientBudgets?.map((budget) => (
                              <SelectItem key={budget.id} value={budget.id}>
                                {budget.code} - {budget.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={contractFilter} onValueChange={setContractFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="Todos los contratos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los contratos</SelectItem>
                            {clientContracts?.map((contract) => (
                              <SelectItem key={contract.id} value={contract.id}>
                                {contract.code} - {contract.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cards View */}
          <TabsContent value="cards" className="mt-4">
        {projectsError ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Error al cargar proyectos</h3>
            <p className="text-sm text-muted-foreground mb-4">{(projectsError as Error).message}</p>
          </div>
        ) : isLoading || assignedLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : !projects || projects.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={hasActiveFilters ? 'No se encontraron proyectos' : 'No hay proyectos operativos'}
            description={
              hasActiveFilters
                ? 'Intenta ajustar los filtros de búsqueda'
                : needsFiltering && assignedClientIds.length === 0
                  ? 'No tienes clientes asignados como AM/PM'
                  : 'Los proyectos operativos te permiten organizar el trabajo por cliente'
            }
            action={
              !hasActiveFilters && !(needsFiltering && assignedClientIds.length === 0)
                ? {
                    label: 'Crear Proyecto',
                    onClick: handleCreate,
                    icon: Plus,
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const stats = requestStats?.[project.id] || { total: 0, completed: 0 };
              const progressPercent = stats.total > 0 
                ? Math.round((stats.completed / stats.total) * 100) 
                : 0;
              return (
                <Card 
                  key={project.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleViewDetail(project.id)}
                >
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{project.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {project.client?.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[project.status as keyof typeof statusColors]}>
                            {statusLabels[project.status as keyof typeof statusLabels]}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetail(project.id); }}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Detalle
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => handleEdit(project, e)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => handleDelete(project, e)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {project.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {project.description}
                        </p>
                      )}

                      {/* Progress section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progreso</span>
                          <span className="font-medium">{progressPercent}%</span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {stats.completed} de {stats.total} requests
                          </span>
                          <Badge variant="outline">
                            {stats.total} requests
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Owner: {project.owner?.full_name || '-'}
                        </span>
                        {project.deadline && (
                          <span className="text-muted-foreground">
                            Deadline: {new Date(project.deadline).toLocaleDateString('es-ES')}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {project.client?.hub_client_url && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a href={project.client.hub_client_url} target="_blank" rel="noopener noreferrer">
                              HUB Cliente
                            </a>
                          </Button>
                        )}
                        {project.hub_project_url && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a href={project.hub_project_url} target="_blank" rel="noopener noreferrer">
                              HUB Proyecto
                            </a>
                          </Button>
                        )}
                        {project.drive_folder_url && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(project.drive_folder_url, '_blank');
                            }}
                          >
                            <img src={GoogleDriveIcon} alt="Drive" className="h-4 w-4 mr-2" />
                            Project DRIVE
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
          </TabsContent>

          {/* Tracking View */}
          <TabsContent value="tracking" className="mt-4">
            <HierarchicalTrackingTable
              filters={trackingFilters}
              hasFilters={hasActiveFilters}
            />
          </TabsContent>
        </Tabs>
      </div>
      <OperationalProjectFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialData={selectedProject}
        mode={modalMode}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el proyecto "{projectToDelete?.name}" y no se puede deshacer.
              Las solicitudes operativas asociadas también serán eliminadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
