import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, ExternalLink, Edit2, Calendar, User, Briefcase, X, ChevronDown, ChevronUp, CheckCircle2, Plus } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useOperationalProject } from '@/hooks/useOperationalProjects';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OperationalProjectFormModal } from '@/components/operations/OperationalProjectFormModal';
import { OperationalRequestFormModal } from '@/components/operations/OperationalRequestFormModal';
import { MilestoneRow } from '@/components/operations/MilestoneRow';
import { toast } from 'sonner';
import GoogleDriveIcon from '@/assets/icons8-google-drive.svg';

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

export default function OperationalProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRequestId, setEditRequestId] = useState<string | null>(null);
  const [deleteRequestId, setDeleteRequestId] = useState<string | null>(null);
  const [createMilestoneModalOpen, setCreateMilestoneModalOpen] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  
  // Filter states
  const [filterSpecialist, setFilterSpecialist] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterService, setFilterService] = useState<string>('all');

  const { data: project, isLoading } = useOperationalProject(id || null);

  // Fetch specialists list
  const { data: specialists = [] } = useQuery({
    queryKey: ['specialists-active-list'],
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

  // Fetch services list
  const { data: services = [] } = useQuery({
    queryKey: ['services-active-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch operational requests for this project
  const { data: operationalRequests, isLoading: loadingRequests } = useQuery({
    queryKey: ['project-operational-requests', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('operational_requests')
        .select(`
          *,
          assignee_user:profiles!operational_requests_assignee_user_id_fkey(id, full_name),
          assignee_specialist:specialists!operational_requests_assignee_specialist_id_fkey(id, name),
          financial_request:financial_requests(id, code, title, service_id, service:services(id, name))
        `)
        .eq('operational_project_id', id)
        .order('deadline', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Filter operational requests
  const filteredRequests = operationalRequests?.filter(request => {
    if (filterSpecialist !== 'all') {
      if (filterSpecialist === 'none') {
        if (request.assignee_specialist_id) return false;
      } else {
        if (request.assignee_specialist_id !== filterSpecialist) return false;
      }
    }
    if (filterStatus !== 'all' && request.status !== filterStatus) return false;
    if (filterService !== 'all') {
      const serviceId = request.financial_request?.service_id;
      if (filterService === 'none') {
        if (serviceId) return false;
      } else {
        if (serviceId !== filterService) return false;
      }
    }
    return true;
  }) || [];

  // Inline update mutation
  const updateRequestMutation = useMutation({
    mutationFn: async ({ requestId, field, value }: { requestId: string; field: string; value: string | null }) => {
      const { error } = await supabase
        .from('operational_requests')
        .update({ [field]: value })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-operational-requests', id] });
      toast.success('Milestone actualizado');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('operational_requests')
        .delete()
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-operational-requests', id] });
      queryClient.invalidateQueries({ queryKey: ['operational-projects'] });
      toast.success('Milestone eliminado');
      setDeleteRequestId(null);
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: string | null }) => {
      const { error } = await supabase
        .from('operational_requests')
        .update({ [field]: value })
        .in('id', selectedRequests);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-operational-requests', id] });
      toast.success(`${selectedRequests.length} milestones actualizados`);
      setSelectedRequests([]);
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Selection handlers
  const toggleSelectAll = () => {
    if (!filteredRequests.length) return;
    if (selectedRequests.length === filteredRequests.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(filteredRequests.map(r => r.id));
    }
  };

  const toggleSelectRequest = (requestId: string) => {
    setSelectedRequests(prev => 
      prev.includes(requestId)
        ? prev.filter(id => id !== requestId)
        : [...prev, requestId]
    );
  };

  const toggleExpandRequest = (requestId: string) => {
    setExpandedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedRequests(new Set(filteredRequests.map(r => r.id)));
  };

  const collapseAll = () => {
    setExpandedRequests(new Set());
  };

  const hasFiltersApplied = filterSpecialist !== 'all' || filterStatus !== 'all' || filterService !== 'all';

  if (isLoading) {
    return (
      <AppLayout title="Cargando..." description="Cargando proyecto operativo">
        <div className="space-y-6">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-48" />
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout title="No encontrado" description="Proyecto no encontrado">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Proyecto no encontrado</h2>
          <Button onClick={() => navigate('/proyectos-operativos')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Proyectos
          </Button>
        </div>
      </AppLayout>
    );
  }

  const status = project.status as keyof typeof statusColors;

  return (
    <AppLayout 
      title={project.name} 
      description={`Proyecto operativo de ${project.client?.name}`}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <p className="text-muted-foreground">{project.client?.name}</p>
            </div>
            <Badge className={statusColors[status]}>
              {statusLabels[status]}
            </Badge>
          </div>
          <Button onClick={() => setEditModalOpen(true)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Editar Proyecto
          </Button>
        </div>

        {/* Project Info Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Account Manager</p>
                  <p className="font-medium">
                    {project.budget?.am_profile?.full_name || project.contract?.am_profile?.full_name || '-'}
                  </p>
                </div>
              </div>
              {(project.budget?.pm_profile?.full_name || project.contract?.pm_profile?.full_name) && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Project Manager</p>
                    <p className="font-medium">
                      {project.budget?.pm_profile?.full_name || project.contract?.pm_profile?.full_name}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Deadline</p>
                  <p className="font-medium">
                    {project.deadline ? new Date(project.deadline).toLocaleDateString('es-ES') : '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Presupuesto</p>
                  <p className="font-medium">
                    {project.budget?.title ? (
                      <Button 
                        variant="link" 
                        className="p-0 h-auto font-medium"
                        onClick={() => navigate(`/presupuestos/${project.budget_id}`)}
                      >
                        {project.budget.title}
                      </Button>
                    ) : '-'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {project.client?.hub_client_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={project.client.hub_client_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      HUB Cliente
                    </a>
                  </Button>
                )}
                {project.hub_project_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={project.hub_project_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      HUB Proyecto
                    </a>
                  </Button>
                )}
                {project.drive_folder_url && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open(project.drive_folder_url, '_blank')}
                  >
                    <img src={GoogleDriveIcon} alt="Drive" className="h-4 w-4 mr-2" />
                    Project DRIVE
                  </Button>
                )}
              </div>
            </div>
            {project.description && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">{project.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Milestones y Tareas - Unified Section */}
        <Card>
          <CardHeader className="pb-4">
            {/* Progress Bar */}
            {operationalRequests && operationalRequests.length > 0 && (
              <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium">Progreso del Proyecto</span>
                  </div>
                  <span className="text-sm font-bold">
                    {Math.round((operationalRequests.filter(r => r.status === 'completed').length / operationalRequests.length) * 100)}%
                  </span>
                </div>
                <Progress 
                  value={(operationalRequests.filter(r => r.status === 'completed').length / operationalRequests.length) * 100} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {operationalRequests.filter(r => r.status === 'completed').length} de {operationalRequests.length} milestones completados
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CardTitle className="flex items-center gap-2">
                  Milestones y Tareas
                  <Badge variant="secondary" className="ml-2">
                    {filteredRequests.length}
                    {filteredRequests.length !== (operationalRequests?.length || 0) && ` de ${operationalRequests?.length || 0}`}
                  </Badge>
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => setCreateMilestoneModalOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Añadir Milestone
                </Button>
              </div>
              
              {/* Filters and Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={filterSpecialist} onValueChange={setFilterSpecialist}>
                  <SelectTrigger className="w-[150px] h-9">
                    <SelectValue placeholder="Especialista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {specialists.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="in_progress">En Progreso</SelectItem>
                    <SelectItem value="in_review">En Revisión</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={filterService} onValueChange={setFilterService}>
                  <SelectTrigger className="w-[150px] h-9">
                    <SelectValue placeholder="Servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="none">Sin servicio</SelectItem>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {hasFiltersApplied && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterSpecialist('all');
                      setFilterStatus('all');
                      setFilterService('all');
                    }}
                    className="h-9 px-3 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpiar
                  </Button>
                )}

                {/* Expand/Collapse All */}
                {filteredRequests.length > 0 && (
                  <div className="flex items-center border-l pl-2 ml-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={expandAll}
                      className="h-9 px-2"
                      title="Expandir todos"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={collapseAll}
                      className="h-9 px-2"
                      title="Colapsar todos"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {loadingRequests ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : !operationalRequests || operationalRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay milestones en este proyecto
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay milestones que coincidan con los filtros
              </div>
            ) : (
              <>
                {/* Bulk Actions Bar */}
                {selectedRequests.length > 0 && (
                  <div className="mb-4 p-3 bg-primary/10 rounded-lg flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedRequests.length === filteredRequests.length}
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="font-medium text-sm">
                        {selectedRequests.length} seleccionado{selectedRequests.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Especialista:</span>
                      <Select
                        onValueChange={(value) => bulkUpdateMutation.mutate({
                          field: 'assignee_specialist_id',
                          value: value === 'none' ? null : value
                        })}
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue placeholder="Cambiar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Quitar asignación</SelectItem>
                          {specialists.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Estado:</span>
                      <Select
                        onValueChange={(value) => bulkUpdateMutation.mutate({
                          field: 'status',
                          value
                        })}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue placeholder="Cambiar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendiente</SelectItem>
                          <SelectItem value="in_progress">En Progreso</SelectItem>
                          <SelectItem value="in_review">En Revisión</SelectItem>
                          <SelectItem value="completed">Completado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedRequests([])}
                      className="ml-auto"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Select All Header */}
                {selectedRequests.length === 0 && (
                  <div className="flex items-center gap-2 mb-3 px-3 text-sm text-muted-foreground">
                    <Checkbox
                      checked={selectedRequests.length === filteredRequests.length && filteredRequests.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span>Seleccionar todos</span>
                  </div>
                )}

                {/* Milestone List */}
                <div className="space-y-3">
                  {filteredRequests.map((request) => (
                    <MilestoneRow
                      key={request.id}
                      milestone={request as any}
                      specialists={specialists}
                      isSelected={selectedRequests.includes(request.id)}
                      isExpanded={expandedRequests.has(request.id)}
                      onToggleSelect={() => toggleSelectRequest(request.id)}
                      onToggleExpand={() => toggleExpandRequest(request.id)}
                      onUpdateField={(field, value) => updateRequestMutation.mutate({ 
                        requestId: request.id, 
                        field, 
                        value 
                      })}
                      onEdit={() => setEditRequestId(request.id)}
                      onDelete={() => setDeleteRequestId(request.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal edición proyecto */}
      <OperationalProjectFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        initialData={project}
        mode="edit"
      />

      {/* Modal edición milestone */}
      <OperationalRequestFormModal
        open={!!editRequestId}
        onOpenChange={(open) => !open && setEditRequestId(null)}
        requestId={editRequestId}
        projectId={id}
        mode="edit"
      />

      {/* Modal creación milestone manual */}
      <OperationalRequestFormModal
        open={createMilestoneModalOpen}
        onOpenChange={setCreateMilestoneModalOpen}
        projectId={id}
        mode="create"
      />

      {/* Confirmación eliminación milestone */}
      <AlertDialog open={!!deleteRequestId} onOpenChange={(open) => !open && setDeleteRequestId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar milestone?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán también las tareas asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteRequestId && deleteRequestMutation.mutate(deleteRequestId)}
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
