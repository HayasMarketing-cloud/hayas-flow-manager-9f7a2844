import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ExternalLink, Edit2, Calendar, User, Briefcase } from 'lucide-react';
import { useOperationalProject } from '@/hooks/useOperationalProjects';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OperationalProjectFormModal } from '@/components/operations/OperationalProjectFormModal';

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
  const [editModalOpen, setEditModalOpen] = useState(false);

  const { data: project, isLoading } = useOperationalProject(id || null);

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
          financial_request:financial_requests(id, code, title)
        `)
        .eq('operational_project_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

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
              <div className="flex gap-2 justify-end">
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
              Solicitudes Operativas ({operationalRequests?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Solicitudes Operativas</CardTitle>
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
                ) : (
                  <div className="space-y-4">
                    {operationalRequests.map((request) => {
                      const reqStatus = request.status as keyof typeof statusColors;
                      const milestoneInfo = milestoneCounts?.[request.id];
                      return (
                        <div 
                          key={request.id}
                          className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{request.name}</h4>
                                <Badge variant="outline" className={statusColors[reqStatus]}>
                                  {statusLabels[reqStatus]}
                                </Badge>
                              </div>
                              {request.description && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {request.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                {request.financial_request?.code && (
                                  <span>Solicitud: {request.financial_request.code}</span>
                                )}
                                {request.assignee_user?.full_name && (
                                  <span>Asignado: {request.assignee_user.full_name}</span>
                                )}
                                {request.assignee_specialist?.name && (
                                  <span>Especialista: {request.assignee_specialist.name}</span>
                                )}
                                {request.deadline && (
                                  <span>Deadline: {new Date(request.deadline).toLocaleDateString('es-ES')}</span>
                                )}
                              </div>
                            </div>
                            {milestoneInfo && (
                              <div className="text-right">
                                <span className="text-sm text-muted-foreground">
                                  Milestones: {milestoneInfo.completed}/{milestoneInfo.total}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <OperationalProjectFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        initialData={project}
        mode="edit"
      />
    </AppLayout>
  );
}
