import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useMyTasks = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get current specialist (if user is specialist)
      const { data: specialist } = await supabase
        .from('specialists')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Get tasks assigned to user or their specialist profile
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          *,
          operational_request:operational_requests(
            id,
            name,
            operational_project_id,
            client_id,
            operational_project:operational_projects(
              id,
              name,
              client:clients(id, name)
            )
          )
        `)
        .or(`assignee_user_id.eq.${user.id}${specialist ? `,assignee_specialist_id.eq.${specialist.id}` : ''}`)
        .neq('status', 'completed')
        .order('deadline', { ascending: true, nullsFirst: false });

      if (error) throw error;

      return tasks || [];
    },
    enabled: !!user?.id,
  });
};

// No longer needed - milestones table was removed
export const useMyMilestones = () => {
  return useQuery({
    queryKey: ['my-milestones-deprecated'],
    queryFn: async () => [],
    enabled: false,
  });
};
