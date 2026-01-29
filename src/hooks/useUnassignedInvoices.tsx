import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UnassignedInvoice {
  id: string;
  code: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  total_amount: number;
  status: string;
  client: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  linked_requests_count: number;
}

export const useUnassignedInvoices = () => {
  return useQuery({
    queryKey: ['unassigned-invoices'],
    queryFn: async () => {
      // Get all invoices with their linked requests count
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          id,
          code,
          invoice_date,
          due_date,
          subtotal,
          total_amount,
          status,
          client:clients(id, name, code),
          linked_requests:financial_requests!billed_invoice_id(id)
        `)
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      // Filter to only invoices without linked requests
      const unassigned = (invoices || [])
        .filter(inv => !inv.linked_requests || inv.linked_requests.length === 0)
        .map(inv => ({
          ...inv,
          linked_requests_count: inv.linked_requests?.length || 0,
        }));

      return unassigned as UnassignedInvoice[];
    },
  });
};
