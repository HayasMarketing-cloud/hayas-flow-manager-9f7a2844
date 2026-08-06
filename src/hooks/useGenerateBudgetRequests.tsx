import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  GenerationLine,
  insertBudgetRequests,
  sendBatchAssignmentNotification,
} from '@/lib/budget-request-generation';

/**
 * Función única de generación de requests desde presupuesto (F2 + F3).
 * "Aprobar y Generar Solicitudes" y "Generar Requests" la comparten.
 * Tras insertar, envía un único email agrupado por especialista notificable.
 */
export const useGenerateBudgetRequests = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      budget,
      lines,
      existingPhases,
      notifySpecialistIds,
    }: {
      budget: any;
      lines: GenerationLine[];
      existingPhases?: string[];
      /** Especialistas a notificar en este acto (toggle del modal) */
      notifySpecialistIds?: string[];
    }) => {
      const { count, requestIds } = await insertBudgetRequests(
        budget,
        lines,
        existingPhases || []
      );

      let notified = 0;
      if (requestIds.length > 0 && (notifySpecialistIds?.length || 0) > 0) {
        try {
          const result = await sendBatchAssignmentNotification(
            requestIds,
            notifySpecialistIds!
          );
          notified = result?.notified || 0;
        } catch (e: any) {
          console.error('Error enviando notificación agrupada:', e);
          toast.warning(
            'Requests creadas, pero falló el envío de la notificación. Puedes reenviarla desde el presupuesto.'
          );
        }
      }

      return { count, notified };
    },
    onSuccess: ({ count, notified }, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budget-detail', variables.budget.id] });
      queryClient.invalidateQueries({ queryKey: ['budget-requests', variables.budget.id] });
      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
      if (count > 0) {
        toast.success(
          `${count} request(s) generada(s)` +
            (notified > 0 ? ` · ${notified} especialista(s) notificado(s)` : '')
        );
      }
    },
    onError: (error: any) => {
      toast.error('Error al generar requests: ' + error.message);
    },
  });
};
