import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type TaskStatus = 'pending' | 'in_progress' | 'in_review' | 'completed';

export interface TaskData {
  id: string;
  name: string;
  description: string | null;
  status: TaskStatus;
  deadline: string | null;
  context_url: string | null;
  notes: string | null;
  order_index: number;
  assignee_user_id: string | null;
  assignee_specialist_id: string | null;
  operational_request_id: string | null;
  assignee_user?: { id: string; full_name: string | null } | null;
  assignee_specialist?: { id: string; name: string } | null;
}

// Helper to execute queries bypassing stale types
// The DB schema was updated (milestone_id -> operational_request_id) but types haven't been regenerated yet
const tasksTable = () => supabase.from('tasks') as any;
const operationalRequestsTable = () => supabase.from('operational_requests') as any;

export const useRequestTasks = (requestId: string | null) => {
  const queryClient = useQueryClient();

  // Fetch tasks for a specific operational request
  const tasksQuery = useQuery({
    queryKey: ['request-tasks', requestId],
    queryFn: async (): Promise<TaskData[]> => {
      if (!requestId) return [];
      const { data, error } = await tasksTable()
        .select(`
          *,
          assignee_user:profiles!tasks_assignee_user_id_fkey(id, full_name),
          assignee_specialist:specialists!tasks_assignee_specialist_id_fkey(id, name)
        `)
        .eq('operational_request_id', requestId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as TaskData[];
    },
    enabled: !!requestId,
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (task: Partial<TaskData> & { operational_request_id: string }) => {
      // Get max order_index
      const { data: existingTasks } = await tasksTable()
        .select('order_index')
        .eq('operational_request_id', task.operational_request_id)
        .order('order_index', { ascending: false })
        .limit(1);

      const maxOrderTask = existingTasks?.[0] as { order_index: number } | undefined;
      const newOrderIndex = (maxOrderTask?.order_index ?? -1) + 1;

      const insertData = {
        name: task.name || 'Nueva tarea',
        description: task.description || null,
        operational_request_id: task.operational_request_id,
        assignee_user_id: task.assignee_user_id || null,
        assignee_specialist_id: task.assignee_specialist_id || null,
        deadline: task.deadline || null,
        context_url: task.context_url || null,
        status: task.status || 'pending',
        notes: task.notes || null,
        order_index: newOrderIndex,
      };

      const { data, error } = await tasksTable()
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-tasks', requestId] });
      toast.success('Tarea creada');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<TaskData> }) => {
      const { error } = await tasksTable()
        .update(updates)
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-tasks', requestId] });
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await tasksTable()
        .delete()
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-tasks', requestId] });
      toast.success('Tarea eliminada');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Reorder tasks mutation
  const reorderTasksMutation = useMutation({
    mutationFn: async (updates: { id: string; order_index: number }[]) => {
      for (const update of updates) {
        const { error } = await tasksTable()
          .update({ order_index: update.order_index })
          .eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-tasks', requestId] });
    },
    onError: (error: any) => {
      toast.error(`Error al reordenar: ${error.message}`);
    },
  });

  return {
    tasks: tasksQuery.data || [],
    isLoading: tasksQuery.isLoading,
    refetch: tasksQuery.refetch,
    createTask: createTaskMutation.mutate,
    updateTask: updateTaskMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    reorderTasks: reorderTasksMutation.mutate,
    isCreating: createTaskMutation.isPending,
    isUpdating: updateTaskMutation.isPending,
  };
};

// Hook to update operational request notes
// Uses type assertion since 'notes' column was just added and types may not be regenerated yet
export const useUpdateRequestNotes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes: string }) => {
      const { error } = await operationalRequestsTable()
        .update({ notes })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-operational-requests'] });
      queryClient.invalidateQueries({ queryKey: ['operational-request', variables.requestId] });
      queryClient.invalidateQueries({ queryKey: ['project-milestones'] });
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });
};
