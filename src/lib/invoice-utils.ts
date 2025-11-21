import { Database } from '@/integrations/supabase/types';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

export const getInvoiceStatusColor = (status: InvoiceStatus): string => {
  const colors: Record<InvoiceStatus, string> = {
    draft: 'bg-muted text-muted-foreground',
    sent: 'bg-blue-500 text-white',
    paid: 'bg-green-500 text-white',
    overdue: 'bg-red-500 text-white',
    cancelled: 'bg-destructive text-destructive-foreground',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
};

export const getInvoiceStatusLabel = (status: InvoiceStatus): string => {
  const labels: Record<InvoiceStatus, string> = {
    draft: 'Borrador',
    sent: 'Enviada',
    paid: 'Pagada',
    overdue: 'Vencida',
    cancelled: 'Cancelada',
  };
  return labels[status] || status;
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

export const isInvoiceEditable = (status: InvoiceStatus): boolean => {
  return status === 'draft';
};

export const getDaysUntilDue = (dueDate: string | null): number | null => {
  if (!dueDate) return null;
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const calculateDueDate = (invoiceDate: string, daysToAdd: number = 30): string => {
  const date = new Date(invoiceDate);
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().split('T')[0];
};

export const isValidDueDate = (invoiceDate: string, dueDate: string): boolean => {
  return new Date(dueDate) >= new Date(invoiceDate);
};
