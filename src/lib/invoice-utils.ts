import { Database } from '@/integrations/supabase/types';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

// === FACTURAS EMITIDAS A CLIENTES ===
// Para facturas emitidas usamos terminología de "cobro" (ingresos)
// Nota: Las futuras facturas de proveedores usarán terminología de "pago" (gastos)

// Simplified status display - only "Cobrada" and "Pendiente de cobro"
export const getInvoiceStatusColor = (status: InvoiceStatus): string => {
  if (status === 'paid') {
    return 'bg-green-500 text-white';
  }
  // All other statuses are considered "Pendiente de cobro"
  return 'bg-amber-500 text-white';
};

export const getInvoiceStatusLabel = (status: InvoiceStatus): string => {
  if (status === 'paid') {
    return 'Cobrada';  // Client invoice = collected
  }
  // All other statuses are considered "Pendiente de cobro"
  return 'Pendiente de cobro';
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
