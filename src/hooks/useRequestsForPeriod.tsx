import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useRequestsForPeriod = (
  clientId?: string,
  month?: number,
  year?: number
) => {
  return useQuery({
    queryKey: ['requests-for-period', clientId, month, year],
    queryFn: async () => {
      if (!clientId || !month || !year) return [];

      // Calcular rango de fechas del período
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // Último día del mes

      const { data, error } = await supabase
        .from('financial_requests')
        .select(`
          *,
          service:services(name),
          specialist:specialists(name)
        `)
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .is('billed_invoice_id', null)
        .gte('completed_at', startDate.toISOString())
        .lte('completed_at', endDate.toISOString())
        .order('completed_at');

      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && !!month && !!year,
  });
};
