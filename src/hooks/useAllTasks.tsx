import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useCurrentSpecialist } from '@/hooks/useCurrentSpecialist';
import { TaskFilters } from './useTaskFilters';
import { useMemo } from 'react';

export interface TaskWithDetails {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  deadline: string | null;
  context_url: string | null;
  notes: string | null;
  order_index: number | null;
  assignee_user_id: string | null;
  assignee_specialist_id: string | null;
  operational_request_id: string | null;
  assignee_specialist: { id: string; name: string } | null;
  assignee_user: { id: string; full_name: string | null } | null;
  operational_request: {
    id: string;
    name: string;
    status: string | null;
    deadline: string | null;
    description: string | null;
    assignee_specialist_id: string | null;
    assignee_specialist: { id: string; name: string } | null;
    operational_project: {
      id: string;
      name: string;
      status: string | null;
      deadline: string | null;
      client_id: string;
      contract_id: string | null;
      budget_id: string | null;
      client: { id: string; name: string } | null;
      contract: { id: string; title: string; code: string } | null;
      budget: { id: string; title: string; code: string } | null;
    } | null;
  } | null;
}

export interface GroupedByProject {
  project: {
    id: string;
    name: string;
    status: string | null;
    deadline: string | null;
    client: { id: string; name: string } | null;
    contract: { id: string; title: string; code: string } | null;
    budget: { id: string; title: string; code: string } | null;
  };
  milestones: {
    milestone: {
      id: string;
      name: string;
      status: string | null;
      deadline: string | null;
      description: string | null;
      assignee_specialist: { id: string; name: string } | null;
    };
    tasks: TaskWithDetails[];
  }[];
}

export const useAllTasks = (filters: TaskFilters) => {
  const { user } = useAuth();
  const { isAdmin, isAccountManager, isProjectManager, loading: rolesLoading } = useUserRole();
  const { specialist } = useCurrentSpecialist();

  // Execute role functions to get boolean values
  const isAdminUser = isAdmin();
  const isAMUser = isAccountManager();
  const isPMUser = isProjectManager();

  // Get assigned client IDs for AM/PM
  const { data: assignedClientIds = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['assigned-clients', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Get clients from contracts where user is AM or PM
      const { data: contractClients } = await supabase
        .from('contracts')
        .select('client_id')
        .or(`am_user_id.eq.${user.id},pm_user_id.eq.${user.id}`);

      // Get clients from budgets where user is AM or PM
      const { data: budgetClients } = await supabase
        .from('budgets')
        .select('client_id')
        .or(`am_user_id.eq.${user.id},pm_user_id.eq.${user.id}`);

      // Get clients from operational projects where user is owner
      const { data: projectClients } = await supabase
        .from('operational_projects')
        .select('client_id')
        .eq('owner_user_id', user.id);

      const allClientIds = [
        ...(contractClients || []).map(c => c.client_id),
        ...(budgetClients || []).map(b => b.client_id),
        ...(projectClients || []).map(p => p.client_id),
      ];

      return [...new Set(allClientIds)];
    },
    enabled: !!user?.id && (isAMUser || isPMUser) && !isAdminUser,
  });

  // Main tasks query
  const { data: tasks = [], isLoading: tasksLoading, refetch } = useQuery({
    queryKey: ['all-tasks', user?.id, isAdminUser, isAMUser, isPMUser, specialist?.id, assignedClientIds, filters],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('tasks')
        .select(`
          *,
          assignee_specialist:specialists!tasks_assignee_specialist_id_fkey(id, name),
          assignee_user:profiles!tasks_assignee_user_id_fkey(id, full_name),
          operational_request:operational_requests(
            id, name, status, deadline, description, assignee_specialist_id,
            assignee_specialist:specialists!operational_requests_assignee_specialist_id_fkey(id, name),
            operational_project:operational_projects(
              id, name, status, deadline, client_id, contract_id, budget_id,
              client:clients(id, name),
              contract:contracts(id, title, code),
              budget:budgets(id, title, code)
            )
          )
        `)
        .order('deadline', { ascending: true, nullsFirst: false });

      // Apply showCompleted filter - only exclude completed if not showing them
      if (!filters.showCompleted) {
        query = query.neq('status', 'completed');
      }

      // Apply role-based visibility
      if (!isAdminUser) {
        if (isAMUser || isPMUser) {
          // AM/PM see tasks for their assigned clients
          if (assignedClientIds.length === 0) {
            return [];
          }
          // We'll filter after fetch since nested filtering is complex
        } else {
          // Specialists only see their assigned tasks
          const conditions: string[] = [];
          conditions.push(`assignee_user_id.eq.${user.id}`);
          if (specialist?.id) {
            conditions.push(`assignee_specialist_id.eq.${specialist.id}`);
          }
          query = query.or(conditions.join(','));
        }
      }

      // Apply "MIS TAREAS" filter
      if (filters.onlyMyTasks) {
        const conditions: string[] = [];
        conditions.push(`assignee_user_id.eq.${user.id}`);
        if (specialist?.id) {
          conditions.push(`assignee_specialist_id.eq.${specialist.id}`);
        }
        query = query.or(conditions.join(','));
      }

      // Apply month filter
      if (filters.monthYear) {
        const [year, month] = filters.monthYear.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${lastDay}`;
        query = query.gte('deadline', startDate).lte('deadline', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filteredTasks = data || [];

      // Post-fetch filtering for AM/PM (nested client filtering)
      if (!isAdminUser && (isAMUser || isPMUser) && assignedClientIds.length > 0) {
        filteredTasks = filteredTasks.filter(task => {
          const clientId = task.operational_request?.operational_project?.client_id;
          return clientId && assignedClientIds.includes(clientId);
        });
      }

      // Apply client filter
      if (filters.clientId) {
        filteredTasks = filteredTasks.filter(task => 
          task.operational_request?.operational_project?.client_id === filters.clientId
        );
      }

      // Apply specialist filter
      if (filters.specialistId) {
        filteredTasks = filteredTasks.filter(task => 
          task.assignee_specialist_id === filters.specialistId ||
          task.operational_request?.assignee_specialist_id === filters.specialistId
        );
      }

      // Apply contract filter
      if (filters.contractId) {
        filteredTasks = filteredTasks.filter(task => 
          task.operational_request?.operational_project?.contract_id === filters.contractId
        );
      }

      // Apply budget filter
      if (filters.budgetId) {
        filteredTasks = filteredTasks.filter(task => 
          task.operational_request?.operational_project?.budget_id === filters.budgetId
        );
      }

      return filteredTasks as TaskWithDetails[];
    },
    enabled: !!user?.id && !rolesLoading && (!((isAMUser || isPMUser) && !isAdminUser) || !clientsLoading),
  });

  // Group tasks by project and milestone
  const groupedTasks = useMemo((): GroupedByProject[] => {
    const projectMap = new Map<string, GroupedByProject>();

    tasks.forEach(task => {
      const project = task.operational_request?.operational_project;
      const milestone = task.operational_request;

      if (!project || !milestone) return;

      if (!projectMap.has(project.id)) {
        projectMap.set(project.id, {
          project: {
            id: project.id,
            name: project.name,
            status: project.status,
            deadline: project.deadline,
            client: project.client,
            contract: project.contract,
            budget: project.budget,
          },
          milestones: [],
        });
      }

      const projectGroup = projectMap.get(project.id)!;
      let milestoneGroup = projectGroup.milestones.find(m => m.milestone.id === milestone.id);

      if (!milestoneGroup) {
        milestoneGroup = {
          milestone: {
            id: milestone.id,
            name: milestone.name,
            status: milestone.status,
            deadline: milestone.deadline,
            description: milestone.description,
            assignee_specialist: milestone.assignee_specialist,
          },
          tasks: [],
        };
        projectGroup.milestones.push(milestoneGroup);
      }

      milestoneGroup.tasks.push(task);
    });

    // Sort tasks within milestones by order_index
    projectMap.forEach(group => {
      group.milestones.forEach(m => {
        m.tasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      });
    });

    return Array.from(projectMap.values());
  }, [tasks]);

  const isLoading = tasksLoading || rolesLoading || clientsLoading;

  return {
    tasks,
    groupedTasks,
    isLoading,
    refetch,
    isAdmin: isAdminUser,
    isAccountManager: isAMUser,
    isProjectManager: isPMUser,
  };
};
