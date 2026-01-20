import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { CheckSquare } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTaskFilters } from '@/hooks/useTaskFilters';
import { useAllTasks } from '@/hooks/useAllTasks';
import { TaskFiltersBar } from '@/components/tasks/TaskFiltersBar';
import { ProjectTaskGroup } from '@/components/tasks/ProjectTaskGroup';

export default function MyTasks() {
  const queryClient = useQueryClient();
  
  const {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    clients,
    specialists,
    contracts,
    budgets,
    monthOptions,
  } = useTaskFilters();

  const { groupedTasks, isLoading, isAdmin, isAccountManager, isProjectManager } = useAllTasks(filters);

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'pending' | 'in_progress' | 'in_review' | 'completed' }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      toast.success('Estado actualizado');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleTaskStatusChange = (taskId: string, status: string) => {
    updateTaskStatus.mutate({ 
      id: taskId, 
      status: status as 'pending' | 'in_progress' | 'in_review' | 'completed' 
    });
  };

  // Determine page description based on role
  const getDescription = () => {
    if (isAdmin) return 'Vista de todas las tareas del sistema';
    if (isAccountManager || isProjectManager) return 'Tareas de tus proyectos y clientes asignados';
    return 'Tareas asignadas a mí';
  };

  if (isLoading) {
    return (
      <AppLayout title="Mis Tareas" description={getDescription()}>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Mis Tareas" description={getDescription()}>
      <div className="space-y-6">
        {/* Filters Bar */}
        <TaskFiltersBar
          filters={filters}
          updateFilter={updateFilter}
          clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          clients={clients}
          specialists={specialists}
          contracts={contracts}
          budgets={budgets}
          monthOptions={monthOptions}
        />

        {/* Tasks Content */}
        {groupedTasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title={hasActiveFilters ? 'No hay tareas con estos filtros' : 'No hay tareas pendientes'}
            description={
              hasActiveFilters
                ? 'Prueba a ajustar los filtros para ver más tareas'
                : 'Las tareas asignadas aparecerán aquí organizadas por proyecto'
            }
          />
        ) : (
          <div className="space-y-4">
            {groupedTasks.map((projectGroup) => (
              <ProjectTaskGroup
                key={projectGroup.project.id}
                projectGroup={projectGroup}
                onTaskStatusChange={handleTaskStatusChange}
                isUpdating={updateTaskStatus.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
