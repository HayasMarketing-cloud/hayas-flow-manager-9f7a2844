import { Database } from '@/integrations/supabase/types';

type BudgetStatus = Database['public']['Tables']['budgets']['Row']['status'];

export const getBudgetStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    sent: 'bg-blue-500 text-white',
    approved: 'bg-green-500 text-white',
    rejected: 'bg-destructive text-destructive-foreground',
    partially_invoiced: 'bg-amber-500 text-white',
    invoiced: 'bg-purple-500 text-white',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
};

export const getBudgetStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    sent: 'Enviado',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    partially_invoiced: 'Facturado parcial',
    invoiced: 'Facturado',
  };
  return labels[status] || status;
};

/** Estados que un usuario puede fijar manualmente (workflow comercial). */
export const MANUAL_BUDGET_STATUSES = ['pending', 'sent', 'approved', 'rejected'] as const;

/** Normaliza el valor almacenado a un estado manual válido (legado 'invoiced' -> 'approved'). */
export const toManualBudgetStatus = (status: string): string =>
  status === 'invoiced' ? 'approved' : status;

/**
 * Estado efectivo del presupuesto: la facturación real (allocations) manda
 * sobre la columna `status`, que sólo refleja el workflow comercial.
 */
export const getEffectiveBudgetStatus = (
  status: string,
  summary?: { percent?: number } | null
): string => {
  const percent = summary?.percent ?? 0;
  if (percent >= 99.5) return 'invoiced';
  if (percent > 0) return 'partially_invoiced';
  return toManualBudgetStatus(status);
};

/** Base de cálculo de un hito: su base propia (p.ej. importe de un PO) o el total del presupuesto. */
export const getMilestoneBase = (
  milestone: { base_amount?: number | null } | null | undefined,
  budgetTotal: number
): number => {
  const base = milestone?.base_amount;
  return base != null && Number(base) > 0 ? Number(base) : Number(budgetTotal || 0);
};

/** Importe de un hito: importe fijado manualmente o base × %. */
export const getMilestoneAmount = (
  milestone: { percentage?: number; base_amount?: number | null; amount?: number | null } | null | undefined,
  budgetTotal: number
): number => {
  if (milestone?.amount != null && !Number.isNaN(Number(milestone.amount))) {
    return Number(milestone.amount);
  }
  const base = getMilestoneBase(milestone, budgetTotal);
  return (base * (Number(milestone?.percentage) || 0)) / 100;
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
    useGrouping: true,
    minimumFractionDigits: 2,
  }).format(amount);
};

export const isBudgetEditable = (status: BudgetStatus): boolean => {
  return true; // Permitir edición en cualquier estado
};

export const canConvertToContract = (status: BudgetStatus): boolean => {
  return status === 'approved';
};
