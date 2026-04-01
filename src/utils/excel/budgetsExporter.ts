import { downloadCSV, formatDate, formatCurrency } from './excelExporter';

export const exportBudgetsToCSV = (budgets: any[]) => {
  const headers = [
    'Código',
    'Título',
    'Cliente',
    'Contacto',
    'PO Number',
    'Monto Total',
    'Estado',
    'Fecha Facturación',
    'Fecha Creación',
  ];

  const statusMap: Record<string, string> = {
    pending: 'Pendiente',
    sent: 'Enviado',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    invoiced: 'Facturado',
  };

  const rows = budgets.map((b) => [
    b.code || '-',
    b.title || '-',
    b.client?.name || '-',
    b.client_contact?.name || '-',
    b.client_po_number || 'Pendiente',
    formatCurrency(b.total_amount),
    statusMap[b.status] || b.status || '-',
    formatDate(b.estimated_invoice_date),
    formatDate(b.created_at),
  ]);

  const totalAmount = budgets.reduce((sum, b) => sum + (b.total_amount || 0), 0);

  rows.push([]);
  rows.push([
    'TOTALES',
    `${budgets.length} presupuestos`,
    '',
    '',
    '',
    formatCurrency(totalAmount),
    '',
    '',
    '',
  ]);

  const data = [headers, ...rows];
  const fileName = `presupuestos_${new Date().toISOString().split('T')[0]}`;
  downloadCSV(data, fileName, 'Presupuestos');
};
