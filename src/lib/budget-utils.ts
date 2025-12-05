import { Database } from '@/integrations/supabase/types';

type BudgetStatus = Database['public']['Tables']['budgets']['Row']['status'];

export const getBudgetStatusColor = (status: BudgetStatus): string => {
  const colors: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    sent: 'bg-blue-500 text-white',
    approved: 'bg-green-500 text-white',
    rejected: 'bg-destructive text-destructive-foreground',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
};

export const getBudgetStatusLabel = (status: BudgetStatus): string => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    sent: 'Enviado',
    approved: 'Aprobado',
    rejected: 'Rechazado',
  };
  return labels[status] || status;
};

export const calculateItemTotal = (quantity: number, unitPrice: number): number => {
  return quantity * unitPrice;
};

export const calculateBudgetTotal = (items: Array<{ total: number }>): number => {
  return items.reduce((sum, item) => sum + item.total, 0);
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

export const isBudgetEditable = (status: BudgetStatus): boolean => {
  return true; // Permitir edición en cualquier estado
};

export const canConvertToContract = (status: BudgetStatus): boolean => {
  return status === 'approved';
};
