import { Database } from '@/integrations/supabase/types';

type LiquidationStatus = Database['public']['Enums']['liquidation_status'];

export const getLiquidationStatusColor = (status: LiquidationStatus): string => {
  const colors: Record<LiquidationStatus, string> = {
    draft: 'bg-muted text-muted-foreground',
    validated: 'bg-purple-500 text-white',
    sent: 'bg-blue-500 text-white',
    accepted: 'bg-teal-500 text-white',
    disputed: 'bg-red-500 text-white',
    pending_payment: 'bg-orange-500 text-white',
    paid: 'bg-green-500 text-white',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
};

export const getLiquidationStatusLabel = (status: LiquidationStatus): string => {
  const labels: Record<LiquidationStatus, string> = {
    draft: 'Borrador',
    validated: 'Validada',
    sent: 'Enviada',
    accepted: 'Aceptada',
    disputed: 'Disputada',
    pending_payment: 'Pendiente de pago',
    paid: 'Pagada',
  };
  return labels[status] || status;
};

export const getMonthName = (month: number, format: 'short' | 'long' = 'long'): string => {
  const monthNamesShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthNamesLong = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  const monthNames = format === 'short' ? monthNamesShort : monthNamesLong;
  return monthNames[month - 1] || '';
};

export const formatPeriod = (year: number, month: number, format: 'short' | 'long' = 'long'): string => {
  return `${getMonthName(month, format)} ${year}`;
};

export const calculateTaxAmount = (subtotal: number, taxRate: number): number => {
  return (subtotal * taxRate) / 100;
};

export const calculateTotalAmount = (subtotal: number, taxAmount: number): number => {
  return subtotal + taxAmount;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

export const isLiquidationEditable = (status: LiquidationStatus): boolean => {
  return status === 'draft';
};

export const getPreviousPeriod = (year: number, month: number): { year: number; month: number } => {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
};

export const getNextPeriod = (year: number, month: number): { year: number; month: number } => {
  if (month === 12) {
    return { year: year + 1, month: 1 };
  }
  return { year, month: month + 1 };
};

export const getCurrentPeriod = (): { year: number; month: number } => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
};

export const isPeriodBefore = (
  year1: number, 
  month1: number, 
  year2: number, 
  month2: number
): boolean => {
  if (year1 < year2) return true;
  if (year1 > year2) return false;
  return month1 < month2;
};

export const getExpectedPaymentDate = (periodYear: number, periodMonth: number): Date => {
  // El pago es el día 28 del mes siguiente al período
  if (periodMonth === 12) {
    // Diciembre → 28 de enero del año siguiente
    return new Date(periodYear + 1, 0, 28); // Enero es mes 0
  }
  // Cualquier otro mes → 28 del mes siguiente (periodMonth ya es 1-12)
  return new Date(periodYear, periodMonth, 28);
};

export const formatExpectedPaymentDate = (periodYear: number, periodMonth: number): string => {
  const date = getExpectedPaymentDate(periodYear, periodMonth);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};
