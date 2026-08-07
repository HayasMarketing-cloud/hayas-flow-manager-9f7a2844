import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type RequestStatus = Database['public']['Enums']['financial_request_status'];

export const REQUEST_STATUSES: RequestStatus[] = [
  'draft',
  'pending_specialist',
  'in_progress',
  'pending_review',
  'completed',
  'cancelled',
];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Borrador',
  pending_specialist: 'Pend. Especialista',
  pending_approval: 'Pend. Aprobación',
  in_progress: 'En Progreso',
  pending_review: 'Pend. Revisión',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

// Estados ofrecidos al crear un request
export const CREATION_STATUSES: RequestStatus[] = ['draft', 'pending_specialist'];

/**
 * Fuente única: el catálogo vive en la tabla `request_status_transitions`
 * y se consulta vía RPC. Nunca duplicar la matriz en el cliente.
 */
export async function fetchAllowedTransitions(from: RequestStatus): Promise<RequestStatus[]> {
  const { data, error } = await supabase.rpc('allowed_request_transitions', { _from: from });
  if (error) throw error;
  return (data ?? []) as RequestStatus[];
}

export async function forceRequestStatus(
  requestId: string,
  newStatus: RequestStatus,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('force_request_status', {
    _request_id: requestId,
    _new_status: newStatus,
    _reason: reason,
  });
  if (error) throw error;
}
