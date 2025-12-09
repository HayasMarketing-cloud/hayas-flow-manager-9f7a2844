import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useUnliquidatedRequests = (specialistId?: string) => {
  return useQuery({
    queryKey: ['unliquidated-requests', specialistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_requests')
        .select(`
          *,
          client:clients(id, name, code),
          service:services(id, name),
          specialist:specialists(id, name),
          billed_invoice:invoices(id, code)
        `)
        .eq('specialist_id', specialistId)
        .is('liquidation_id', null)
        .in('status', ['active', 'invoiced'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!specialistId,
  });
};
