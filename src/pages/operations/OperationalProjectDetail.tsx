import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ExternalLink, Edit2, Calendar, User, Briefcase, MoreHorizontal, Trash2, X } from 'lucide-react';
import { useOperationalProject } from '@/hooks/useOperationalProjects';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OperationalProjectFormModal } from '@/components/operations/OperationalProjectFormModal';
import { OperationalRequestFormModal } from '@/components/operations/OperationalRequestFormModal';
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
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  
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
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Filter operational requests
  const filteredRequests = operationalRequests?.filter(request => {
    // Filter by specialist
    if (filterSpecialist !== 'all') {
      if (filterSpecialist === 'none') {
        if (request.assignee_specialist_id) return false;
      } else {
        if (request.assignee_specialist_id !== filterSpecialist) return false;
      }
    }
    // Filter by status
    if (filterStatus !== 'all' && request.status !== filterStatus) return false;
    // Filter by service (via financial_request)
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

  // Fetch milestones count per request
  const { data: milestoneCounts } = useQuery({
    queryKey: ['project-milestone-counts', id],
    queryFn: async () => {
      if (!operationalRequests || operationalRequests.length === 0) return {};
      const { data, error } = await supabase
        .from('milestones')
        .select('id, operational_request_id, status')
        .in('operational_request_id', operationalRequests.map(r => r.id));
      if (error) throw error;
      
      const counts: Record<string, { total: number; completed: number }> = {};
      data?.forEach(m => {
        if (!counts[m.operational_request_id]) {
          counts[m.operational_request_id] = { total: 0, completed: 0 };
        }
        counts[m.operational_request_id].total++;
        if (m.status === 'completed') {
          counts[m.operational_request_id].completed++;
        }
      });
      return counts;
    },
    enabled: !!operationalRequests && operationalRequests.length > 0,
  });

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
      toast.success('Solicitud actualizada');
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
      toast.success('Solicitud eliminada');
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
      toast.success(`${selectedRequests.length} solicitudes actualizadas`);
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
                  <p className="text-sm text-muted-foreground">Owner</p>
                  <p className="font-medium">{project.owner?.full_name || '-'}</p>
                </div>
              </div>
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

        {/* Tabs */}
        <Tabs defaultValue="requests" className="space-y-4">
          <TabsList>
            <TabsTrigger value="requests">
              Solicitudes Operativas ({filteredRequests.length}{filteredRequests.length !== (operationalRequests?.length || 0) ? ` de ${operationalRequests?.length || 0}` : ''})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>Solicitudes Operativas</CardTitle>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={filterSpecialist} onValueChange={setFilterSpecialist}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="Especialista" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los especialistas</SelectItem>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {specialists.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[150px] h-9">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="in_progress">En Progreso</SelectItem>
                      <SelectItem value="in_review">En Revisión</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterService} onValueChange={setFilterService}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="Servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los servicios</SelectItem>
                      <SelectItem value="none">Sin servicio</SelectItem>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    No hay solicitudes operativas en este proyecto
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay solicitudes que coincidan con los filtros
                  </div>
                ) : (
                  <>
                    {/* Bulk Action Bar */}
                    {selectedRequests.length > 0 && (
                      <div className="mb-4 p-3 bg-primary/10 rounded-lg flex flex-wrap items-center gap-3">
                        <span className="font-medium text-sm">
                          {selectedRequests.length} seleccionado{selectedRequests.length > 1 ? 's' : ''}
                        </span>
                        <div className="h-4 w-px bg-border" />
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Especialista:</span>
                          <Select
                            onValueChange={(value) => bulkUpdateMutation.mutate({
                              field: 'assignee_specialist_id',
                              value: value === 'none' ? null : value
                            })}
                          >
                            <SelectTrigger className="w-[160px] h-8">
                              <SelectValue placeholder="Cambiar..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin asignar</SelectItem>
                              {specialists.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Deadline:</span>
                          <Input
                            type="date"
                            className="w-[140px] h-8"
                            onChange={(e) => bulkUpdateMutation.mutate({
                              field: 'deadline',
                              value: e.target.value || null
                            })}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Estado:</span>
                          <Select
                            onValueChange={(value) => bulkUpdateMutation.mutate({
                              field: 'status',
                              value
                            })}
                          >
                            <SelectTrigger className="w-[140px] h-8">
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
                          <X className="h-4 w-4 mr-1" />
                          Limpiar
                        </Button>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={filteredRequests.length > 0 && selectedRequests.length === filteredRequests.length}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="w-[35%]">Descripción</TableHead>
                          <TableHead>Especialista</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRequests.map((request) => {
                          const milestoneInfo = milestoneCounts?.[request.id];
                          return (
                            <TableRow key={request.id} className={selectedRequests.includes(request.id) ? 'bg-primary/5' : ''}>
                              {/* Checkbox */}
                              <TableCell>
                                <Checkbox
                                  checked={selectedRequests.includes(request.id)}
                                  onCheckedChange={() => toggleSelectRequest(request.id)}
                                />
                              </TableCell>
                              {/* Información */}
                              <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">{request.name}</div>
                                {request.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2">
                                    {request.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  {request.financial_request?.code && (
                                    <span>Solicitud: {request.financial_request.code}</span>
                                  )}
                                  {milestoneInfo && (
                                    <span>Milestones: {milestoneInfo.completed}/{milestoneInfo.total}</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            {/* Especialista - Editable */}
                            <TableCell>
                              <Select
                                value={request.assignee_specialist_id || 'none'}
                                onValueChange={(value) => updateRequestMutation.mutate({
                                  requestId: request.id,
                                  field: 'assignee_specialist_id',
                                  value: value === 'none' ? null : value
                                })}
                              >
                                <SelectTrigger className="w-[160px]">
                                  <SelectValue placeholder="Sin asignar" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sin asignar</SelectItem>
                                  {specialists.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>

                            {/* Deadline - Editable */}
                            <TableCell>
                              <Input
                                type="date"
                                value={request.deadline || ''}
                                onChange={(e) => updateRequestMutation.mutate({
                                  requestId: request.id,
                                  field: 'deadline',
                                  value: e.target.value || null
                                })}
                                className="w-[140px]"
                              />
                            </TableCell>

                            {/* Estado - Editable */}
                            <TableCell>
                              <Select
                                value={request.status || 'pending'}
                                onValueChange={(value) => updateRequestMutation.mutate({
                                  requestId: request.id,
                                  field: 'status',
                                  value
                                })}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pendiente</SelectItem>
                                  <SelectItem value="in_progress">En Progreso</SelectItem>
                                  <SelectItem value="in_review">En Revisión</SelectItem>
                                  <SelectItem value="completed">Completado</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>

                            {/* Acciones */}
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setEditRequestId(request.id)}>
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => setDeleteRequestId(request.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal edición proyecto */}
      <OperationalProjectFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        initialData={project}
        mode="edit"
      />

      {/* Modal edición solicitud */}
      <OperationalRequestFormModal
        open={!!editRequestId}
        onOpenChange={(open) => !open && setEditRequestId(null)}
        requestId={editRequestId}
        projectId={id}
        mode="edit"
      />

      {/* Confirmación eliminación */}
      <AlertDialog open={!!deleteRequestId} onOpenChange={(open) => !open && setDeleteRequestId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar solicitud operativa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán también los milestones y tareas asociados.
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
