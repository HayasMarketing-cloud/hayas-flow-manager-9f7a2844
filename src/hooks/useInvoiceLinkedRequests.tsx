import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LinkedRequest {
  id: string;
  code: string;
  title: string;
  sale_amount: number | null;
  status: string;
  completed_at: string | null;
  service: { name: string } | null;
  specialist: { name: string } | null;
}

export const useInvoiceLinkedRequests = (invoiceId?: string) => {
  return useQuery({
    queryKey: ['invoice-linked-requests', invoiceId],
    queryFn: async (): Promise<LinkedRequest[]> => {
      if (!invoiceId) return [];

      const { data, error } = await supabase
        .from('financial_requests')
        .select(`
          id, code, title, sale_amount, status, completed_at,
          service:services(name),
          specialist:specialists(name)
        `)
        .eq('billed_invoice_id', invoiceId)
        .order('code');

      if (error) throw error;
      return (data as LinkedRequest[]) || [];
    },
    enabled: !!invoiceId,
  });
};
