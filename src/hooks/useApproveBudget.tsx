import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { notifyBudgetApproved, notifyAMRequestPONumber } from '@/lib/notification-utils';
import { notificationFeedback } from '@/lib/notification-feedback';

interface ApproveBudgetParams {
  budgetId: string;
  onSuccess?: () => void;
}

export const useApproveBudget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ budgetId }: ApproveBudgetParams) => {
      // 1. Actualizar el estado del presupuesto a "approved"
      const { error: budgetError } = await supabase
        .from('budgets')
        .update({ status: 'approved' })
        .eq('id', budgetId);

      if (budgetError) throw budgetError;

      // 2. Obtener el presupuesto (la generación de requests vive en
      //    useGenerateBudgetRequests: función única compartida)
      const { data: budget, error: fetchBudgetError } = await supabase
        .from('budgets')
        .select(`
          *,
          budget_items(*),
          client:clients(name)
        `)
        .eq('id', budgetId)
        .single();

      if (fetchBudgetError) throw fetchBudgetError;

      return budget;
    },
    onSuccess: async (budget, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
      toast.success('Presupuesto aprobado');

      
      // Send in-app notification to relevant roles
      await notifyBudgetApproved(budget.code, budget.id, budget.title);
      
      // Show notification feedback
      notificationFeedback.budgetApproved(budget.code);
      
      // Notify AM to request PO Number if missing
      const poMissing = !budget.client_po_number 
        || budget.client_po_number.trim() === '' 
        || budget.client_po_number.trim().toLowerCase() === 'pendiente';
      
      if (budget.am_user_id && poMissing) {
        await notifyAMRequestPONumber(
          budget.am_user_id,
          budget.code,
          budget.id,
          (budget as any).client?.name
        );
      }
      
      variables.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error('Error al aprobar presupuesto: ' + error.message);
    },
  });
};
