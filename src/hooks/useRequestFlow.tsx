import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useRequestFlow = (requestId: string | null) => {
  return useQuery({
    queryKey: ['request-flow', requestId],
    queryFn: async () => {
      if (!requestId) return null;

      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          client:clients(id, name, code),
          service:services(id, name),
          specialist:specialists(id, name),
          billed_invoice:invoices!requests_billed_invoice_id_fkey(id, code, status, total_amount),
          liquidation:liquidations!requests_liquidation_id_fkey(id, code, status, total_amount)
        `)
        .eq('id', requestId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });
};

export const useRequestsWithFlow = (filters?: any) => {
  return useQuery({
    queryKey: ['requests-with-flow', filters],
    queryFn: async () => {
      let query = supabase
        .from('requests')
        .select(`
          *,
          client:clients(id, name, code),
          service:services(id, name),
          specialist:specialists(id, name),
          billed_invoice:invoices!requests_billed_invoice_id_fkey(id, code, status, total_amount),
          liquidation:liquidations!requests_liquidation_id_fkey(id, code, status, total_amount)
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters?.specialistId) {
        query = query.eq('specialist_id', filters.specialistId);
      }
      if (filters?.flowStage) {
        // Filtros específicos del flujo
        switch (filters.flowStage) {
          case 'pending':
            query = query.is('billed_invoice_id', null);
            break;
          case 'invoiced':
            query = query.not('billed_invoice_id', 'is', null).is('liquidation_id', null);
            break;
          case 'liquidated':
            query = query.not('liquidation_id', 'is', null);
            break;
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

export const useCompletedRequestsForInvoicing = () => {
  return useQuery({
    queryKey: ['completed-requests-for-invoicing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          client:clients(id, name, code),
          service:services(id, name),
          specialist:specialists(id, name)
        `)
        .eq('status', 'completed')
        .is('billed_invoice_id', null)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useInvoicedRequestsForLiquidation = (specialistId?: string) => {
  return useQuery({
    queryKey: ['invoiced-requests-for-liquidation', specialistId],
    queryFn: async () => {
      let query = supabase
        .from('requests')
        .select(`
          *,
          client:clients(id, name, code),
          service:services(id, name),
          specialist:specialists(id, name),
          billed_invoice:invoices!requests_billed_invoice_id_fkey(id, code, status, total_amount)
        `)
        .not('billed_invoice_id', 'is', null)
        .is('liquidation_id', null)
        .not('specialist_id', 'is', null)
        .order('created_at', { ascending: false });

      if (specialistId) {
        query = query.eq('specialist_id', specialistId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: specialistId !== undefined,
  });
};
