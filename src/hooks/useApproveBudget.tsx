import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

      // 2. Obtener el presupuesto y sus items
      const { data: budget, error: fetchBudgetError } = await supabase
        .from('budgets')
        .select(`
          *,
          budget_items(*)
        `)
        .eq('id', budgetId)
        .single();

      if (fetchBudgetError) throw fetchBudgetError;

      // 3. Generar financial_requests automáticamente desde budget_items
      if (budget.budget_items && budget.budget_items.length > 0) {
        const itemsWithoutService = budget.budget_items.filter((item: any) => !item.service_id);

        if (itemsWithoutService.length > 0) {
          throw new Error(
            'Hay líneas del presupuesto sin servicio asignado. Edita el presupuesto y selecciona un servicio en todas las líneas antes de aprobarlo.'
          );
        }

        const requestsToInsert = budget.budget_items.map((item: any) => ({
          title: item.description,
          description: `Generado automáticamente desde presupuesto: ${budget.title}`,
          client_id: budget.client_id,
          service_id: item.service_id,
          budget_id: budgetId,
          quantity: item.quantity,
          unit_price: item.unit_price || 0,
          sale_amount: item.total || 0,
          status: 'active' as const,
          code: '', // El trigger generate_request_code lo generará automáticamente
        }));

        const { error: requestsError } = await supabase
          .from('financial_requests')
          .insert(requestsToInsert);

        if (requestsError) throw requestsError;
      }

      return budget;
    },
    onSuccess: (budget, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
      toast.success(`Presupuesto aprobado y ${budget.budget_items?.length || 0} solicitud(es) financiera(s) creada(s)`);
      variables.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error('Error al aprobar presupuesto: ' + error.message);
    },
  });
};
