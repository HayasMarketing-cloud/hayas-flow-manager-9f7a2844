import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AvailableRequest {
  id: string;
  code: string;
  title: string;
  sale_amount: number | null;
  completed_at: string | null;
  client_id: string;
  budget: {
    id: string;
    code: string;
    title: string;
  } | null;
  contract: {
    id: string;
    code: string;
    title: string;
  } | null;
  service: {
    name: string;
  } | null;
  specialist: {
    name: string;
  } | null;
  operational_request: {
    operational_project: {
      id: string;
      name: string;
    } | null;
  }[] | null;
}

export const useAvailableRequestsForReconciliation = (clientId?: string) => {
  return useQuery({
    queryKey: ['available-requests-for-reconciliation', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('financial_requests')
        .select(`
          id,
          code,
          title,
          sale_amount,
          completed_at,
          client_id,
          budget:budgets(id, code, title),
          contract:contracts(id, code, title),
          service:services(name),
          specialist:specialists(name),
          operational_request:operational_requests(
            operational_project:operational_projects(id, name)
          )
        `)
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .is('billed_invoice_id', null)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      return data as AvailableRequest[];
    },
    enabled: !!clientId,
  });
};
