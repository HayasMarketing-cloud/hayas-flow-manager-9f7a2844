import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TaskData {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  deadline: string | null;
  order_index: number | null;
  context_url: string | null;
  milestone_id: string;
  assignee_user_id: string | null;
  assignee_specialist_id: string | null;
  assignee_user?: { id: string; full_name: string | null } | null;
  assignee_specialist?: { id: string; name: string } | null;
}

export interface MilestoneData {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  deadline: string | null;
  order_index: number | null;
  context_url: string | null;
  reviewer_type: string | null;
  operational_request_id: string;
  assignee_user_id: string | null;
  assignee_specialist_id: string | null;
  assignee_user?: { id: string; full_name: string | null } | null;
  assignee_specialist?: { id: string; name: string } | null;
  tasks: TaskData[];
}

export interface OperationalRequestWithMilestones {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  deadline: string | null;
  assignee_specialist_id: string | null;
  assignee_specialist?: { id: string; name: string } | null;
  milestones: MilestoneData[];
}

export const useMilestonesWithTasks = (projectId: string | null) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['milestones-with-tasks', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      // Fetch operational requests for this project
      const { data: requests, error: reqError } = await supabase
        .from('operational_requests')
        .select(`
          id,
          name,
          description,
          status,
          deadline,
          assignee_specialist_id,
          assignee_specialist:specialists!operational_requests_assignee_specialist_id_fkey(id, name)
        `)
        .eq('operational_project_id', projectId)
        .order('created_at', { ascending: true });

      if (reqError) throw reqError;
      if (!requests || requests.length === 0) return [];

      const requestIds = requests.map(r => r.id);

      // Fetch milestones for these requests
      const { data: milestones, error: milError } = await supabase
        .from('milestones')
        .select(`
          id,
          name,
          description,
          status,
          deadline,
          order_index,
          context_url,
          reviewer_type,
          operational_request_id,
          assignee_user_id,
          assignee_specialist_id,
          assignee_user:profiles!milestones_assignee_user_id_fkey(id, full_name),
          assignee_specialist:specialists!milestones_assignee_specialist_id_fkey(id, name)
        `)
        .in('operational_request_id', requestIds)
        .order('order_index', { ascending: true, nullsFirst: false });

      if (milError) throw milError;

      const milestoneIds = milestones?.map(m => m.id) || [];

      // Fetch tasks for these milestones
      let tasks: TaskData[] = [];
      if (milestoneIds.length > 0) {
        const { data: tasksData, error: taskError } = await supabase
          .from('tasks')
          .select(`
            id,
            name,
            description,
            status,
            deadline,
            order_index,
            context_url,
            milestone_id,
            assignee_user_id,
            assignee_specialist_id,
            assignee_user:profiles!tasks_assignee_user_id_fkey(id, full_name),
            assignee_specialist:specialists!tasks_assignee_specialist_id_fkey(id, name)
          `)
          .in('milestone_id', milestoneIds)
          .order('order_index', { ascending: true, nullsFirst: false });

        if (taskError) throw taskError;
        tasks = tasksData || [];
      }

      // Build the hierarchical structure
      const result: OperationalRequestWithMilestones[] = requests.map(request => {
        const requestMilestones = (milestones || [])
          .filter(m => m.operational_request_id === request.id)
          .map(milestone => ({
            ...milestone,
            tasks: tasks.filter(t => t.milestone_id === milestone.id)
          }));

        return {
          ...request,
          milestones: requestMilestones
        };
      });

      return result;
    },
    enabled: !!projectId,
  });

  // Reorder milestones mutation
  const reorderMilestonesMutation = useMutation({
    mutationFn: async ({ milestoneIds }: { milestoneIds: string[] }) => {
      const updates = milestoneIds.map((id, index) => ({
        id,
        order_index: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('milestones')
          .update({ order_index: update.order_index })
          .eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones-with-tasks', projectId] });
    },
    onError: (error: any) => {
      toast.error(`Error al reordenar: ${error.message}`);
    },
  });

  // Reorder tasks mutation
  const reorderTasksMutation = useMutation({
    mutationFn: async ({ taskIds }: { taskIds: string[] }) => {
      const updates = taskIds.map((id, index) => ({
        id,
        order_index: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('tasks')
          .update({ order_index: update.order_index })
          .eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones-with-tasks', projectId] });
    },
    onError: (error: any) => {
      toast.error(`Error al reordenar: ${error.message}`);
    },
  });

  // Delete milestone mutation
  const deleteMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      // First delete all tasks
      const { error: taskError } = await supabase
        .from('tasks')
        .delete()
        .eq('milestone_id', milestoneId);
      if (taskError) throw taskError;

      // Then delete milestone
      const { error } = await supabase
        .from('milestones')
        .delete()
        .eq('id', milestoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones-with-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-milestone-counts'] });
      queryClient.invalidateQueries({ queryKey: ['my-milestones'] });
      toast.success('Milestone eliminado');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones-with-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast.success('Tarea eliminada');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Update task status mutation
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: 'pending' | 'in_progress' | 'in_review' | 'completed' }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones-with-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Update milestone status mutation
  const updateMilestoneStatusMutation = useMutation({
    mutationFn: async ({ milestoneId, status }: { milestoneId: string; status: 'pending' | 'in_progress' | 'in_review' | 'completed' }) => {
      const { error } = await supabase
        .from('milestones')
        .update({ status })
        .eq('id', milestoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones-with-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['my-milestones'] });
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
    reorderMilestones: reorderMilestonesMutation.mutate,
    reorderTasks: reorderTasksMutation.mutate,
    deleteMilestone: deleteMilestoneMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    updateTaskStatus: updateTaskStatusMutation.mutate,
    updateMilestoneStatus: updateMilestoneStatusMutation.mutate,
    isReordering: reorderMilestonesMutation.isPending || reorderTasksMutation.isPending,
  };
};
