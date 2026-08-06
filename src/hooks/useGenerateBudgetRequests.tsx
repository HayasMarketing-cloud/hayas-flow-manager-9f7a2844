import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { GenerationLine, insertBudgetRequests } from '@/lib/budget-request-generation';

/**
 * Función única de generación de requests desde presupuesto (F2).
 * "Aprobar y Generar Solicitudes" y "Generar Requests" la comparten.
 */
export const useGenerateBudgetRequests = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ budget, lines }: { budget: any; lines: GenerationLine[] }) => {
      return await insertBudgetRequests(budget, lines);
    },
    onSuccess: (count, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budget-detail', variables.budget.id] });
      queryClient.invalidateQueries({ queryKey: ['budget-requests', variables.budget.id] });
      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
      if (count > 0) {
        toast.success(`${count} request(s) generada(s) correctamente`);
      }
    },
    onError: (error: any) => {
      toast.error('Error al generar requests: ' + error.message);
    },
  });
};
