import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useAvailableInvoicesForRequests = (clientId: string | null) => {
  return useQuery({
    queryKey: ['available-invoices-for-requests', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('invoices')
        .select('id, code, subtotal, total_amount, status, invoice_date, due_date')
        .eq('client_id', clientId)
        .neq('status', 'paid')
        .order('invoice_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });
};
