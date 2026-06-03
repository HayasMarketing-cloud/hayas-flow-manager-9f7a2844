import { downloadCSV, formatDate, formatCurrency } from './excelExporter';

export const exportRequestsToCSV = (requests: any[], filters?: any) => {
  const headers = [
    'Código',
    'Título',
    'Cliente',
    'Origen',
    'Servicio',
    'Especialista',
    'Horas / Coste',
    'Ref. Partner',
    'Solicitado por',
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

  const rows = requests.map((request) => {
    const origen = request.budget
      ? `Presupuesto: ${request.budget.code || ''}${request.budget.title ? ` – ${request.budget.title}` : ''}`.trim()
      : request.contract
      ? `Contrato: ${request.contract.title || request.contract.code || ''}`.trim()
      : 'Sin origen';
    return [
    request.code || '-',
    request.title || '-',
    request.client?.name || '-',
    origen,
    request.service?.name || '-',
    request.specialist?.name || '-',
    request.hours ? `${request.hours}h` : ((request.fixed_cost || request.cost_to_agency) ? formatCurrency(Number(request.fixed_cost ?? request.cost_to_agency)) : '-'),
    request.partner_reference || '-',
    request.client_contact?.name || '-',
    request.status || '-',
    request.quantity || 0,
    formatCurrency(request.unit_price),
    formatCurrency(request.total),
    formatCurrency(Number(request.cost_to_agency ?? request.fixed_cost ?? 0)),
    request.margin ? `${request.margin.toFixed(2)}%` : '-',
    formatDate(request.created_at),
    formatDate(request.completed_at),
    request.billed_invoice_id ? 'Sí' : 'No',
    request.liquidation_id ? 'Sí' : 'No',
  ];
  });

  // Añadir fila de totales
  const totalAmount = requests.reduce((sum, r) => sum + (r.total || 0), 0);
  const totalCost = requests.reduce((sum, r) => sum + Number(r.cost_to_agency ?? r.fixed_cost ?? 0), 0);
  const totalHours = requests.reduce((sum, r) => sum + (r.hours || 0), 0);
  const totalMargin = totalAmount > 0 ? ((totalAmount - totalCost) / totalAmount) * 100 : 0;

  rows.push([]);
  rows.push([
    'TOTALES',
    '',
    '',
    '',
    '',
    '',
    totalHours ? `${totalHours}h` : '-',
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
  downloadCSV(data, fileName, 'Solicitudes');
};

// Keep old name as alias for backwards compatibility
export const exportRequestsToExcel = exportRequestsToCSV;
