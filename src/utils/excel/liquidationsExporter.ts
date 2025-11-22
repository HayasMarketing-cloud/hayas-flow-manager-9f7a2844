import { downloadExcel, formatDate, formatCurrency } from './excelExporter';

export const exportLiquidationsToExcel = (liquidations: any[], filters?: any) => {
  const headers = [
    'Código',
    'Especialista',
    'Período',
    'Estado',
    'Subtotal',
    'IVA (%)',
    'IVA (€)',
    'Total',
    'Fecha Envío',
    'Fecha Pago',
    'Notas',
  ];

  const rows = liquidations.map((liquidation) => {
    const monthName = new Date(liquidation.period_year, liquidation.period_month - 1)
      .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    return [
      liquidation.code || '-',
      liquidation.specialist?.name || '-',
      monthName,
      liquidation.status || '-',
      formatCurrency(liquidation.subtotal),
      liquidation.tax_rate?.toFixed(2) || '0',
      formatCurrency(liquidation.tax_amount),
      formatCurrency(liquidation.total_amount),
      formatDate(liquidation.sent_at),
      formatDate(liquidation.paid_at),
      liquidation.notes || '-',
    ];
  });

  // Añadir fila de totales
  const totalSubtotal = liquidations.reduce((sum, l) => sum + (l.subtotal || 0), 0);
  const totalTax = liquidations.reduce((sum, l) => sum + (l.tax_amount || 0), 0);
  const totalAmount = liquidations.reduce((sum, l) => sum + (l.total_amount || 0), 0);

  rows.push([]);
  rows.push([
    'TOTALES',
    '',
    '',
    liquidations.length + ' liquidaciones',
    formatCurrency(totalSubtotal),
    '',
    formatCurrency(totalTax),
    formatCurrency(totalAmount),
    '',
    '',
    '',
  ]);

  const data = [headers, ...rows];

  const fileName = `liquidaciones_${new Date().toISOString().split('T')[0]}`;
  downloadExcel(data, fileName, 'Liquidaciones');
};
