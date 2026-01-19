import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { notifyBudgetApproved } from '@/lib/notification-utils';
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

        // Obtener tarifas por hora de los especialistas asignados
        const specialistIds = budget.budget_items
          .filter((item: any) => item.specialist_id)
          .map((item: any) => item.specialist_id);

        let specialistsMap: Record<string, number> = {};
        if (specialistIds.length > 0) {
          const { data: specialists } = await supabase
            .from('specialists')
            .select('id, hourly_rate')
            .in('id', specialistIds);
          
          specialists?.forEach((s: any) => {
            specialistsMap[s.id] = s.hourly_rate || 0;
          });
        }

        const requestsToInsert = budget.budget_items.map((item: any) => {
          const specialistRate = item.specialist_id 
            ? specialistsMap[item.specialist_id] || 0 
            : 0;
          const hours = item.quantity || 0;
          const costToAgency = specialistRate > 0 ? hours * specialistRate : null;

          return {
            title: item.description,
            description: `Generado automáticamente desde presupuesto: ${budget.title}`,
            client_id: budget.client_id,
            client_contact_id: budget.client_contact_id || null,
            service_id: item.service_id,
            specialist_id: item.specialist_id || null,
            budget_id: budgetId,
            budget_item_id: item.id,
            quantity: item.quantity,
            unit_price: item.unit_price || 0,
            sale_amount: item.total || 0,
            status: 'pending_specialist' as const,
            code: '',
            // Auto-calcular coste si hay especialista con tarifa por hora
            cost_type: specialistRate > 0 ? 'hourly' as const : null,
            hours: specialistRate > 0 ? hours : null,
            cost_rate: specialistRate > 0 ? specialistRate : null,
            cost_to_agency: costToAgency,
          };
        });

        const { error: requestsError } = await supabase
          .from('financial_requests')
          .insert(requestsToInsert);

        if (requestsError) throw requestsError;
      }

      return budget;
    },
    onSuccess: async (budget, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
      toast.success(`Presupuesto aprobado y ${budget.budget_items?.length || 0} solicitud(es) financiera(s) creada(s)`);
      
      // Send in-app notification to relevant roles
      await notifyBudgetApproved(budget.code, budget.id, budget.title);
      
      // Show notification feedback
      notificationFeedback.budgetApproved(budget.code);
      
      variables.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error('Error al aprobar presupuesto: ' + error.message);
    },
  });
};
