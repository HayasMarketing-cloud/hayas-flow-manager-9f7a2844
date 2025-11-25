import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useMyTasks, useMyMilestones } from '@/hooks/useMyTasks';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { CheckSquare, Calendar, ExternalLink } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export default function MyTasks() {
  const { data: tasks, isLoading: tasksLoading } = useMyTasks();
  const { data: milestones, isLoading: milestonesLoading } = useMyMilestones();
  const queryClient = useQueryClient();

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: any }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast.success('Estado actualizado');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const updateMilestoneStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: any }) => {
      const { error } = await supabase
        .from('milestones')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-milestones'] });
      toast.success('Estado actualizado');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const isLoading = tasksLoading || milestonesLoading;

  if (isLoading) {
    return (
      <AppLayout title="Mis Tareas">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </AppLayout>
    );
  }

  const hasNoTasks = (!tasks || tasks.length === 0) && (!milestones || milestones.length === 0);

  if (hasNoTasks) {
    return (
      <AppLayout title="Mis Tareas">
        <EmptyState
          icon={CheckSquare}
          title="No tienes tareas pendientes"
          description="Las tareas y hitos asignados a ti aparecerán aquí"
        />
      </AppLayout>
    );
  }

  // Group tasks by project
  const tasksByProject = tasks?.reduce((acc, task) => {
    const project = task.milestone?.operational_request?.operational_project;
    if (!project) return acc;

    const projectKey = project.id;
    if (!acc[projectKey]) {
      acc[projectKey] = {
        project,
        tasks: [],
      };
    }
    acc[projectKey].tasks.push(task);
    return acc;
  }, {} as Record<string, any>);

  // Group milestones by project
  const milestonesByProject = milestones?.reduce((acc, milestone) => {
    const project = milestone.operational_request?.operational_project;
    if (!project) return acc;

    const projectKey = project.id;
    if (!acc[projectKey]) {
      acc[projectKey] = {
        project,
        milestones: [],
      };
    }
    acc[projectKey].milestones.push(milestone);
    return acc;
  }, {} as Record<string, any>);

  return (
    <AppLayout 
      title="Mis Tareas" 
      description="Tareas y hitos asignados a mí"
    >
      <div className="space-y-6">
        {/* Milestones */}
        {milestonesByProject && Object.keys(milestonesByProject).length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Hitos Pendientes</h2>
            {Object.values(milestonesByProject).map((group: any) => (
              <Card key={group.project.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{group.project.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {group.project.client?.name}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {group.milestones.map((milestone: any) => (
                      <div
                        key={milestone.id}
                        className="flex items-start gap-3 p-3 rounded-lg border"
                      >
                        <Checkbox
                          checked={milestone.status === 'completed'}
                          onCheckedChange={(checked) => {
                            updateMilestoneStatus.mutate({
                              id: milestone.id,
                              status: checked ? 'completed' : 'in_progress',
                            });
                          }}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{milestone.name}</span>
                            <Badge className={statusColors[milestone.status as keyof typeof statusColors]}>
                              {statusLabels[milestone.status as keyof typeof statusLabels]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {milestone.operational_request?.name}
                          </p>
                          {milestone.deadline && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(milestone.deadline).toLocaleDateString('es-ES')}
                            </div>
                          )}
                          {milestone.context_url && (
                            <Button variant="link" size="sm" className="h-auto p-0" asChild>
                              <a href={milestone.context_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Ver contexto
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tasks */}
        {tasksByProject && Object.keys(tasksByProject).length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Tareas Pendientes</h2>
            {Object.values(tasksByProject).map((group: any) => (
              <Card key={group.project.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{group.project.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {group.project.client?.name}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {group.tasks.map((task: any) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 p-3 rounded-lg border"
                      >
                        <Checkbox
                          checked={task.status === 'completed'}
                          onCheckedChange={(checked) => {
                            updateTaskStatus.mutate({
                              id: task.id,
                              status: checked ? 'completed' : 'in_progress',
                            });
                          }}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{task.name}</span>
                            <Badge className={statusColors[task.status as keyof typeof statusColors]}>
                              {statusLabels[task.status as keyof typeof statusLabels]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Hito: {task.milestone?.name}
                          </p>
                          {task.deadline && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.deadline).toLocaleDateString('es-ES')}
                            </div>
                          )}
                          {task.context_url && (
                            <Button variant="link" size="sm" className="h-auto p-0" asChild>
                              <a href={task.context_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Ver contexto
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
