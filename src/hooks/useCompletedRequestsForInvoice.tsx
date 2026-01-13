import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useCompletedRequestsForInvoice = (clientId?: string) => {
  return useQuery({
    queryKey: ['completed-requests-for-invoice', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('financial_requests')
        .select(`
          *,
          service:services(name),
          specialist:specialists(name),
          budget:budgets(id),
          contract:contracts(id)
        `)
        .eq('client_id', clientId)
        .in('status', ['completed', 'in_progress', 'pending_review'])
        .is('billed_invoice_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });
};

// Hook para obtener precio sugerido de una request
export const useSuggestedPrice = async (requestId: string) => {
  // Primero buscar en budget_items
  const { data: budgetItems } = await supabase
    .from('financial_requests')
    .select('budget_id')
    .eq('id', requestId)
    .maybeSingle();

  if (budgetItems?.budget_id) {
    const { data: items } = await supabase
      .from('budget_items')
      .select('unit_price, service_id')
      .eq('budget_id', budgetItems.budget_id)
      .limit(1)
      .maybeSingle();
    
    if (items?.unit_price) return items.unit_price;
  }

  // Luego buscar en contract_services
  const { data: contractRequest } = await supabase
    .from('financial_requests')
    .select('contract_id, specialist_id, service_id')
    .eq('id', requestId)
    .maybeSingle();

  if (contractRequest?.contract_id) {
    const { data: contractService } = await supabase
      .from('contract_services')
      .select('price_value')
      .eq('contract_id', contractRequest.contract_id)
      .eq('service_id', contractRequest.service_id)
      .maybeSingle();
    
    if (contractService?.price_value) return contractService.price_value;
  }

  return 0;
};
