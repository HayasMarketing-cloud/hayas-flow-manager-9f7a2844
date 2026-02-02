import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BudgetForInvoice {
  id: string;
  code: string;
  title: string;
  total_amount: number | null;
  status: string;
}

export const useBudgetsForInvoice = (clientId?: string, currentInvoiceId?: string) => {
  return useQuery({
    queryKey: ['budgets-for-invoice', clientId, currentInvoiceId],
    queryFn: async () => {
      if (!clientId) return [];

      // Get all approved budgets for this client
      const { data: budgets, error: budgetsError } = await supabase
        .from('budgets')
        .select('id, code, title, total_amount, status')
        .eq('client_id', clientId)
        .in('status', ['approved', 'invoiced'])
        .order('created_at', { ascending: false });

      if (budgetsError) throw budgetsError;

      // Get budgets already linked to other invoices
      const { data: linkedInvoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('budget_id')
        .not('budget_id', 'is', null);

      if (invoicesError) throw invoicesError;

      // Filter out budgets already linked to other invoices (not this one)
      const linkedBudgetIds = (linkedInvoices || [])
        .filter(inv => inv.budget_id !== currentInvoiceId)
        .map(inv => inv.budget_id);

      const availableBudgets = (budgets || []).filter(
        budget => !linkedBudgetIds.includes(budget.id)
      );

      return availableBudgets as BudgetForInvoice[];
    },
    enabled: !!clientId,
  });
};
