import { downloadCSV, formatDate, formatCurrency } from './excelExporter';

export const exportInvoicesToCSV = (invoices: any[], filters?: any) => {
  const headers = [
    'Código',
    'Cliente',
    'Fecha Factura',
    'Fecha Vencimiento',
    'Estado',
    'Subtotal',
    'IVA (%)',
    'IVA (€)',
    'Total',
    'Fecha Envío',
    'Fecha Pago',
    'Notas',
  ];

  const rows = invoices.map((invoice) => [
    invoice.code || '-',
    invoice.client?.name || '-',
    formatDate(invoice.invoice_date),
    formatDate(invoice.due_date),
    invoice.status || '-',
    formatCurrency(invoice.subtotal),
    invoice.tax_rate?.toFixed(2) || '0',
    formatCurrency(invoice.tax_amount),
    formatCurrency(invoice.total_amount),
    formatDate(invoice.sent_at),
    formatDate(invoice.paid_at),
    invoice.notes || '-',
  ]);

  // Añadir fila de totales
  const totalSubtotal = invoices.reduce((sum, i) => sum + (i.subtotal || 0), 0);
  const totalTax = invoices.reduce((sum, i) => sum + (i.tax_amount || 0), 0);
  const totalAmount = invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);

  rows.push([]);
  rows.push([
    'TOTALES',
    '',
    '',
    '',
    invoices.length + ' facturas',
    formatCurrency(totalSubtotal),
    '',
    formatCurrency(totalTax),
    formatCurrency(totalAmount),
    '',
    '',
    '',
  ]);

  const data = [headers, ...rows];

  const fileName = `facturas_${new Date().toISOString().split('T')[0]}`;
  downloadCSV(data, fileName, 'Facturas');
};

// Keep old name as alias for backwards compatibility
export const exportInvoicesToExcel = exportInvoicesToCSV;
