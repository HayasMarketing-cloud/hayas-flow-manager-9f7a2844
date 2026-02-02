import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContractForInvoice {
  id: string;
  code: string;
  title: string;
  total_amount: number | null;
  status: string;
}

export const useContractsForInvoice = (clientId?: string) => {
  return useQuery({
    queryKey: ['contracts-for-invoice', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('contracts')
        .select('id, code, title, total_amount, status')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ContractForInvoice[];
    },
    enabled: !!clientId,
  });
};
