import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAssignedClients } from './useAssignedClients';
import { useCurrentSpecialist } from './useCurrentSpecialist';
import { useUserRole } from './useUserRole';
import { toast } from 'sonner';

export interface MilestoneWithDetails {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  deadline: string | null;
  context_url: string | null;
  notes: string | null;
  operational_project_id: string;
  assignee_specialist_id: string | null;
  assignee_user_id: string | null;
  client_id: string;
  created_at: string | null;
  operational_project: {
    id: string;
    name: string;
    status: string | null;
    deadline: string | null;
    client: { id: string; name: string } | null;
    contract: { id: string; title: string; code: string } | null;
    budget: { id: string; title: string; code: string; estimated_invoice_date: string | null } | null;
  } | null;
  assignee_specialist: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  tasks: { id: string; status: string }[];
}

export interface MilestoneFilters {
  clientId?: string;
  specialistId?: string;
  contractId?: string;
  budgetId?: string;
  status?: string;
  searchTerm?: string;
  month?: string; // YYYY-MM format
}

export const useProjectMilestones = (filters?: MilestoneFilters) => {
  const { assignedClientIds, isLoading: assignedLoading, needsFiltering } = useAssignedClients();
  const { specialistId: currentSpecialistId, isLoading: specialistLoading } = useCurrentSpecialist();
  const { isSpecialist } = useUserRole();

  return useQuery({
    queryKey: ['project-milestones', filters, assignedClientIds, currentSpecialistId, needsFiltering, isSpecialist()],
    queryFn: async (): Promise<MilestoneWithDetails[]> => {
      // For AM/PM filtering
      if (needsFiltering && (!assignedClientIds || assignedClientIds.length === 0)) {
        return [];
      }

      let query = supabase
        .from('operational_requests')
        .select(`
          id,
          name,
          description,
          status,
          deadline,
          context_url,
          notes,
          operational_project_id,
          assignee_specialist_id,
          assignee_user_id,
          client_id,
          created_at,
          operational_project:operational_projects!operational_requests_operational_project_id_fkey(
            id,
            name,
            status,
            deadline,
            client:clients!operational_projects_client_id_fkey(id, name),
            contract:contracts!operational_projects_contract_id_fkey(id, title, code),
            budget:budgets!operational_projects_budget_id_fkey(id, title, code, estimated_invoice_date)
          ),
          assignee_specialist:specialists!operational_requests_assignee_specialist_id_fkey(id, name),
          client:clients!operational_requests_client_id_fkey(id, name),
          tasks(id, status)
        `)
        .order('deadline', { ascending: true, nullsFirst: false });

      // Apply AM/PM client filtering
      if (needsFiltering) {
        query = query.in('client_id', assignedClientIds);
      }

      // Specialist can only see their assigned milestones
      if (isSpecialist() && currentSpecialistId) {
        query = query.eq('assignee_specialist_id', currentSpecialistId);
      }

      // Apply filters
      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters?.specialistId) {
        query = query.eq('assignee_specialist_id', filters.specialistId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status as 'pending' | 'in_progress' | 'in_review' | 'completed');
      }
      if (filters?.searchTerm) {
        query = query.or(`name.ilike.%${filters.searchTerm}%,operational_project.name.ilike.%${filters.searchTerm}%`);
      }
      if (filters?.month) {
        const [year, month] = filters.month.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
        query = query.gte('deadline', startDate).lte('deadline', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Post-filter by contract/budget if needed (can't filter nested relations easily)
      let results = (data || []) as any[];
      
      if (filters?.contractId) {
        results = results.filter(m => m.operational_project?.contract?.id === filters.contractId);
      }
      if (filters?.budgetId) {
        results = results.filter(m => m.operational_project?.budget?.id === filters.budgetId);
      }

      return results as MilestoneWithDetails[];
    },
    enabled: !assignedLoading && !specialistLoading,
  });
};

export const useUpdateMilestoneStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ milestoneId, status }: { milestoneId: string; status: string }) => {
      const { error } = await supabase
        .from('operational_requests')
        .update({ status: status as 'pending' | 'in_progress' | 'in_review' | 'completed' })
        .eq('id', milestoneId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-milestones'] });
      queryClient.invalidateQueries({ queryKey: ['project-operational-requests'] });
      toast.success('Estado actualizado');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });
};
