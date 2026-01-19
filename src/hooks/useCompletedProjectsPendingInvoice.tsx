import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CompletedProject {
  id: string;
  name: string;
  completed_at: string | null;
  client: {
    id: string;
    name: string;
  };
  budget: {
    id: string;
    code: string;
    total_amount: number | null;
  } | null;
  contract: {
    id: string;
    code: string;
  } | null;
  requests_count: number;
  total_amount: number;
}

export function useCompletedProjectsPendingInvoice() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['completed-projects-pending-invoice'],
    queryFn: async (): Promise<CompletedProject[]> => {
      // Get completed operational projects
      const { data: projects, error: projectsError } = await supabase
        .from('operational_projects')
        .select(`
          id,
          name,
          updated_at,
          client:clients!operational_projects_client_id_fkey(id, name),
          budget:budgets(id, code, total_amount),
          contract:contracts(id, code)
        `)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false });

      if (projectsError) throw projectsError;

      if (!projects || projects.length === 0) return [];

      // Get requests for each project to check if they're billed
      const projectsWithRequests = await Promise.all(
        projects.map(async (project) => {
          // Get operational requests for this project
          const { data: opRequests } = await supabase
            .from('operational_requests')
            .select('financial_request_id')
            .eq('operational_project_id', project.id)
            .not('financial_request_id', 'is', null);

          const financialRequestIds = opRequests?.map(r => r.financial_request_id).filter(Boolean) || [];

          if (financialRequestIds.length === 0) {
            // No financial requests linked, consider as pending
            return {
              ...project,
              requests_count: 0,
              total_amount: project.budget?.total_amount || 0,
              has_unbilled_requests: true,
            };
          }

          // Check which requests are NOT billed yet
          const { data: unbilledRequests } = await supabase
            .from('financial_requests')
            .select('id, sale_amount')
            .in('id', financialRequestIds)
            .is('billed_invoice_id', null)
            .neq('status', 'cancelled');

          const unbilledCount = unbilledRequests?.length || 0;
          const totalUnbilledAmount = unbilledRequests?.reduce((sum, r) => sum + (r.sale_amount || 0), 0) || 0;

          return {
            ...project,
            requests_count: unbilledCount,
            total_amount: totalUnbilledAmount,
            has_unbilled_requests: unbilledCount > 0,
          };
        })
      );

      // Filter only projects with unbilled requests or no requests (needs review)
      const pendingProjects = projectsWithRequests.filter(p => p.has_unbilled_requests);

      return pendingProjects.map(p => ({
        id: p.id,
        name: p.name,
        completed_at: p.updated_at,
        client: p.client as { id: string; name: string },
        budget: p.budget as { id: string; code: string; total_amount: number | null } | null,
        contract: p.contract as { id: string; code: string } | null,
        requests_count: p.requests_count,
        total_amount: p.total_amount,
      }));
    },
    enabled: !!user,
    refetchInterval: 60000, // Refresh every minute
  });
}
