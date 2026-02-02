import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InvoiceAllocationSummary {
  invoice_id: string;
  total_allocated: number;
  allocation_count: number;
  percentage: number;
}

// Fetch allocation summaries for multiple invoices at once
export const useInvoiceAllocationSummaries = (invoiceIds: string[]) => {
  return useQuery({
    queryKey: ['invoice-allocation-summaries', invoiceIds],
    queryFn: async () => {
      if (invoiceIds.length === 0) return new Map<string, InvoiceAllocationSummary>();

      // Get all allocations for the given invoices
      const { data: allocations, error } = await supabase
        .from('invoice_budget_allocations')
        .select('invoice_id, allocated_amount')
        .in('invoice_id', invoiceIds);

      if (error) throw error;

      // Get invoice totals
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, total_amount')
        .in('id', invoiceIds);

      if (invoicesError) throw invoicesError;

      const invoiceTotalsMap = new Map<string, number>();
      (invoices || []).forEach(inv => {
        invoiceTotalsMap.set(inv.id, Number(inv.total_amount));
      });

      // Group allocations by invoice
      const summaryMap = new Map<string, InvoiceAllocationSummary>();
      
      // Initialize all invoices with zero allocations
      invoiceIds.forEach(id => {
        const invoiceTotal = invoiceTotalsMap.get(id) || 0;
        summaryMap.set(id, {
          invoice_id: id,
          total_allocated: 0,
          allocation_count: 0,
          percentage: 0,
        });
      });

      // Sum up allocations
      (allocations || []).forEach(a => {
        const existing = summaryMap.get(a.invoice_id);
        if (existing) {
          existing.total_allocated += Number(a.allocated_amount);
          existing.allocation_count += 1;
          const invoiceTotal = invoiceTotalsMap.get(a.invoice_id) || 0;
          existing.percentage = invoiceTotal > 0 
            ? (existing.total_allocated / invoiceTotal) * 100 
            : 0;
        }
      });

      return summaryMap;
    },
    enabled: invoiceIds.length > 0,
  });
};
