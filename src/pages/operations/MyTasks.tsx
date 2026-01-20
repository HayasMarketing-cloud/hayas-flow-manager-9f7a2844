import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useMyTasks } from '@/hooks/useMyTasks';
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
  const { data: tasks, isLoading } = useMyTasks();
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

  if (!tasks || tasks.length === 0) {
    return (
      <AppLayout title="Mis Tareas">
        <EmptyState
          icon={CheckSquare}
          title="No tienes tareas pendientes"
          description="Las tareas asignadas a ti aparecerán aquí"
        />
      </AppLayout>
    );
  }

  // Group tasks by project
  const tasksByProject = tasks.reduce((acc, task) => {
    const project = task.operational_request?.operational_project;
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

  return (
    <AppLayout 
      title="Mis Tareas" 
      description="Tareas asignadas a mí"
    >
      <div className="space-y-4">
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
                        {task.operational_request?.name}
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
    </AppLayout>
  );
}
