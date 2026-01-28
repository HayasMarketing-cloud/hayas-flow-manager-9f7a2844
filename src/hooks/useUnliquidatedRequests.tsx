import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useUnliquidatedRequests = (
  specialistId?: string,
  periodYear?: number,
  periodMonth?: number
) => {
  return useQuery({
    queryKey: ['unliquidated-requests', specialistId, periodYear, periodMonth],
    queryFn: async () => {
      const selectFields = `
        *,
        client:clients(id, name, code),
        service:services(id, name),
        specialist:specialists(id, name),
        billed_invoice:invoices(id, code),
        budget:budgets(id, code, title),
        operational_request:operational_requests!financial_request_id(
          id,
          operational_project:operational_projects(id, name)
        )
      `;

      // Get all COMPLETED requests without liquidation
      const { data: completedData, error: completedError } = await supabase
        .from('financial_requests')
        .select(selectFields)
        .eq('specialist_id', specialistId)
        .is('liquidation_id', null)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (completedError) throw completedError;

      // Get IN_PROGRESS requests with deadline in the NEXT month (relative to liquidation period)
      let inProgressData: any[] = [];
      
      if (periodYear && periodMonth) {
        // Calculate next month
        const nextMonth = periodMonth === 12 ? 1 : periodMonth + 1;
        const nextYear = periodMonth === 12 ? periodYear + 1 : periodYear;
        
        // Calculate date range for next month
        const startDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
        const lastDayOfMonth = new Date(nextYear, nextMonth, 0).getDate();
        const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

        const { data: inProgress, error: inProgressError } = await supabase
          .from('financial_requests')
          .select(selectFields)
          .eq('specialist_id', specialistId)
          .is('liquidation_id', null)
          .eq('status', 'in_progress')
          .gte('deadline', startDate)
          .lte('deadline', endDate)
          .order('deadline', { ascending: true });

        if (inProgressError) throw inProgressError;
        inProgressData = inProgress || [];
      }

      // Combine results: completed first, then in_progress
      return [...(completedData || []), ...inProgressData];
    },
    enabled: !!specialistId,
  });
};
