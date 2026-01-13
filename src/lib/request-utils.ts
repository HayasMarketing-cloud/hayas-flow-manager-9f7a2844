import { Database } from '@/integrations/supabase/types';

type FinancialRequestStatus = Database['public']['Enums']['financial_request_status'];

export const getFinancialRequestStatusColor = (status: FinancialRequestStatus): string => {
  const colors: Record<FinancialRequestStatus, string> = {
    draft: 'bg-muted text-muted-foreground',
    pending_specialist: 'bg-yellow-500 text-white',
    pending_approval: 'bg-orange-500 text-white',
    in_progress: 'bg-blue-500 text-white',
    pending_review: 'bg-purple-500 text-white',
    completed: 'bg-green-500 text-white',
    cancelled: 'bg-destructive text-destructive-foreground',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
};

export const getFinancialRequestStatusLabel = (status: FinancialRequestStatus): string => {
  const labels: Record<FinancialRequestStatus, string> = {
    draft: 'Borrador',
    pending_specialist: 'Pend. Especialista',
    pending_approval: 'Pend. Aprobación',
    in_progress: 'En Progreso',
    pending_review: 'Pend. Revisión',
    completed: 'Completado',
    cancelled: 'Cancelado',
  };
  return labels[status] || status;
};

// Backward compatibility aliases
export const getRequestStatusColor = getFinancialRequestStatusColor;
export const getRequestStatusLabel = getFinancialRequestStatusLabel;

export const calculateTotal = (quantity: number, unitPrice: number): number => {
  return quantity * unitPrice;
};

export const calculateMargin = (total: number, cost: number | null): number | null => {
  if (cost === null) return null;
  return total - cost;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};
