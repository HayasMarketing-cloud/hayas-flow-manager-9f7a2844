import { downloadExcel, formatDate, formatCurrency } from './excelExporter';

export const exportRequestsToExcel = (requests: any[], filters?: any) => {
  const headers = [
    'Código',
    'Título',
    'Cliente',
    'Servicio',
    'Especialista',
    'Estado',
    'Cantidad',
    'Precio Unit.',
    'Total',
    'Coste',
    'Margen',
    'Fecha Creación',
    'Completado',
    'Facturado',
    'Liquidado',
  ];

  const rows = requests.map((request) => [
    request.code || '-',
    request.title || '-',
    request.client?.name || '-',
    request.service?.name || '-',
    request.specialist?.name || '-',
    request.status || '-',
    request.quantity || 0,
    formatCurrency(request.unit_price),
    formatCurrency(request.total),
    formatCurrency(request.cost),
    request.margin ? `${request.margin.toFixed(2)}%` : '-',
    formatDate(request.created_at),
    formatDate(request.completed_at),
    request.billed_invoice_id ? 'Sí' : 'No',
    request.liquidation_id ? 'Sí' : 'No',
  ]);

  // Añadir fila de totales
  const totalAmount = requests.reduce((sum, r) => sum + (r.total || 0), 0);
  const totalCost = requests.reduce((sum, r) => sum + (r.cost || 0), 0);
  const totalMargin = totalAmount > 0 ? ((totalAmount - totalCost) / totalAmount) * 100 : 0;

  rows.push([]);
  rows.push([
    'TOTALES',
    '',
    '',
    '',
    '',
    '',
    requests.length,
    '',
    formatCurrency(totalAmount),
    formatCurrency(totalCost),
    `${totalMargin.toFixed(2)}%`,
    '',
    '',
    '',
    '',
  ]);

  const data = [headers, ...rows];

  const fileName = `solicitudes_${new Date().toISOString().split('T')[0]}`;
  downloadExcel(data, fileName, 'Solicitudes');
};
