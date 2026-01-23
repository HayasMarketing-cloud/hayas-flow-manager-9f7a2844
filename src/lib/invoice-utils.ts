import { Database } from '@/integrations/supabase/types';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

// Simplified status display - only "Pagada" and "Pendiente de pago"
export const getInvoiceStatusColor = (status: InvoiceStatus): string => {
  if (status === 'paid') {
    return 'bg-green-500 text-white';
  }
  // All other statuses are considered "Pendiente de pago"
  return 'bg-amber-500 text-white';
};

export const getInvoiceStatusLabel = (status: InvoiceStatus): string => {
  if (status === 'paid') {
    return 'Pagada';
  }
  // All other statuses are considered "Pendiente de pago"
  return 'Pendiente de pago';
};

// Check if invoice is pending payment (not paid)
export const isInvoicePending = (status: InvoiceStatus): boolean => {
  return status !== 'paid';
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
