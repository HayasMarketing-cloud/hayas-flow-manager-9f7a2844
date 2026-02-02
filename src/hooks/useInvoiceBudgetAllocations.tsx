import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BudgetAllocation {
  id?: string;
  invoice_id?: string;
  budget_id: string;
  budget_code: string;
  budget_title: string;
  budget_total: number;
  allocated_amount: number;
  budget_invoiced_amount: number; // Already invoiced from this budget (from other allocations)
  budget_remaining: number; // Pending to invoice from this budget
  notes?: string;
}

export interface AllocationSummary {
  total_allocated: number;
  invoice_remaining: number; // invoice.total - total_allocated
  is_fully_allocated: boolean;
  percentage: number;
}

// Fetch allocations for a specific invoice
export const useInvoiceAllocations = (invoiceId?: string) => {
  return useQuery({
    queryKey: ['invoice-allocations', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];

      const { data, error } = await supabase
        .from('invoice_budget_allocations')
        .select(`
          id,
          invoice_id,
          budget_id,
          allocated_amount,
          notes,
          budget:budgets(id, code, title, total_amount)
        `)
        .eq('invoice_id', invoiceId);

      if (error) throw error;

      // Get all allocations for each budget to calculate totals
      const budgetIds = (data || []).map(a => a.budget_id);
      
      const { data: allBudgetAllocations } = await supabase
        .from('invoice_budget_allocations')
        .select('budget_id, allocated_amount')
        .in('budget_id', budgetIds);

      // Calculate invoiced amount per budget
      const budgetInvoicedMap = new Map<string, number>();
      (allBudgetAllocations || []).forEach(a => {
        const current = budgetInvoicedMap.get(a.budget_id) || 0;
        budgetInvoicedMap.set(a.budget_id, current + Number(a.allocated_amount));
      });

      return (data || []).map(a => {
        const budget = a.budget as any;
        const budgetTotal = Number(budget?.total_amount || 0);
        const budgetInvoicedTotal = budgetInvoicedMap.get(a.budget_id) || 0;
        
        return {
          id: a.id,
          invoice_id: a.invoice_id,
          budget_id: a.budget_id,
          budget_code: budget?.code || '',
          budget_title: budget?.title || '',
          budget_total: budgetTotal,
          allocated_amount: Number(a.allocated_amount),
          budget_invoiced_amount: budgetInvoicedTotal,
          budget_remaining: budgetTotal - budgetInvoicedTotal,
          notes: a.notes,
        } as BudgetAllocation;
      });
    },
    enabled: !!invoiceId,
  });
};

// Fetch allocations for a specific budget (to show on budget detail)
export const useBudgetAllocations = (budgetId?: string) => {
  return useQuery({
    queryKey: ['budget-allocations', budgetId],
    queryFn: async () => {
      if (!budgetId) return [];

      const { data, error } = await supabase
        .from('invoice_budget_allocations')
        .select(`
          id,
          invoice_id,
          budget_id,
          allocated_amount,
          notes,
          invoice:invoices(id, code, status, total_amount, invoice_date)
        `)
        .eq('budget_id', budgetId);

      if (error) throw error;

      return (data || []).map(a => ({
        id: a.id,
        invoice_id: a.invoice_id,
        budget_id: a.budget_id,
        allocated_amount: Number(a.allocated_amount),
        notes: a.notes,
        invoice: a.invoice as any,
      }));
    },
    enabled: !!budgetId,
  });
};

// Calculate allocation summary for an invoice
export const calculateAllocationSummary = (
  invoiceTotal: number,
  allocations: BudgetAllocation[]
): AllocationSummary => {
  const total_allocated = allocations.reduce((sum, a) => sum + a.allocated_amount, 0);
  const invoice_remaining = invoiceTotal - total_allocated;
  const percentage = invoiceTotal > 0 ? (total_allocated / invoiceTotal) * 100 : 0;
  
  return {
    total_allocated,
    invoice_remaining,
    is_fully_allocated: Math.abs(invoice_remaining) < 0.01, // Float tolerance
    percentage: Math.round(percentage * 100) / 100,
  };
};

// Save allocations for an invoice
export const useSaveInvoiceAllocations = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      allocations,
    }: {
      invoiceId: string;
      allocations: BudgetAllocation[];
    }) => {
      // Delete existing allocations
      const { error: deleteError } = await supabase
        .from('invoice_budget_allocations')
        .delete()
        .eq('invoice_id', invoiceId);

      if (deleteError) throw deleteError;

      // Insert new allocations
      if (allocations.length > 0) {
        const { error: insertError } = await supabase
          .from('invoice_budget_allocations')
          .insert(
            allocations.map(a => ({
              invoice_id: invoiceId,
              budget_id: a.budget_id,
              allocated_amount: a.allocated_amount,
              notes: a.notes || null,
            }))
          );

        if (insertError) throw insertError;
      }

      // Update budget statuses - mark as invoiced if fully allocated
      for (const allocation of allocations) {
        // Get total invoiced for this budget
        const { data: budgetData } = await supabase
          .from('budgets')
          .select('total_amount, status')
          .eq('id', allocation.budget_id)
          .single();

        if (budgetData && budgetData.status === 'approved') {
          const { data: totalAllocations } = await supabase
            .from('invoice_budget_allocations')
            .select('allocated_amount')
            .eq('budget_id', allocation.budget_id);

          const totalInvoiced = (totalAllocations || []).reduce(
            (sum, a) => sum + Number(a.allocated_amount),
            0
          );

          // If budget is fully invoiced, update status
          if (totalInvoiced >= Number(budgetData.total_amount || 0)) {
            await supabase
              .from('budgets')
              .update({ status: 'invoiced' })
              .eq('id', allocation.budget_id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['budget-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budgets-for-invoice'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error) => {
      console.error('Error saving allocations:', error);
      toast.error('Error al guardar las asignaciones');
    },
  });
};

// Get available budgets with their allocation status
export const useAvailableBudgetsWithAllocations = (clientId?: string, excludeInvoiceId?: string) => {
  return useQuery({
    queryKey: ['available-budgets-allocations', clientId, excludeInvoiceId],
    queryFn: async () => {
      if (!clientId) return [];

      // Get all approved/invoiced budgets for this client
      const { data: budgets, error: budgetsError } = await supabase
        .from('budgets')
        .select('id, code, title, total_amount, status')
        .eq('client_id', clientId)
        .in('status', ['approved', 'invoiced'])
        .order('created_at', { ascending: false });

      if (budgetsError) throw budgetsError;

      // Get all allocations for these budgets
      const budgetIds = (budgets || []).map(b => b.id);
      
      const { data: allocations } = await supabase
        .from('invoice_budget_allocations')
        .select('budget_id, allocated_amount, invoice_id')
        .in('budget_id', budgetIds);

      // Calculate invoiced amount per budget (excluding current invoice)
      const budgetInvoicedMap = new Map<string, number>();
      (allocations || []).forEach(a => {
        if (excludeInvoiceId && a.invoice_id === excludeInvoiceId) return; // Exclude current invoice
        const current = budgetInvoicedMap.get(a.budget_id) || 0;
        budgetInvoicedMap.set(a.budget_id, current + Number(a.allocated_amount));
      });

      return (budgets || []).map(b => {
        const budgetTotal = Number(b.total_amount || 0);
        const budgetInvoiced = budgetInvoicedMap.get(b.id) || 0;
        const remaining = budgetTotal - budgetInvoiced;

        return {
          id: b.id,
          code: b.code,
          title: b.title,
          total_amount: budgetTotal,
          invoiced_amount: budgetInvoiced,
          remaining_amount: remaining,
          status: b.status,
          is_fully_invoiced: remaining <= 0.01, // Tolerancia de 1 céntimo para evitar falsos positivos por redondeo
        };
      });
    },
    enabled: !!clientId,
  });
};
