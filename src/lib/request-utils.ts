import { Database } from '@/integrations/supabase/types';

type RequestStatus = Database['public']['Enums']['request_status'];

export const getRequestStatusColor = (status: RequestStatus): string => {
  const colors: Record<RequestStatus, string> = {
    draft: 'bg-muted text-muted-foreground',
    pending_approval: 'bg-yellow-500 text-white',
    approved: 'bg-blue-500 text-white',
    in_progress: 'bg-purple-500 text-white',
    completed: 'bg-green-500 text-white',
    billed: 'bg-emerald-700 text-white',
    cancelled: 'bg-destructive text-destructive-foreground',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
};

export const getRequestStatusLabel = (status: RequestStatus): string => {
  const labels: Record<RequestStatus, string> = {
    draft: 'Borrador',
    pending_approval: 'Pendiente',
    approved: 'Aprobado',
    in_progress: 'En Progreso',
    completed: 'Completado',
    billed: 'Facturado',
    cancelled: 'Cancelado',
  };
  return labels[status] || status;
};

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
