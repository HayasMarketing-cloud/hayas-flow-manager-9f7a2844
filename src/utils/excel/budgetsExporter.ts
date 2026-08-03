import { downloadCSV, formatDate, formatCurrency } from './excelExporter';
import type { BudgetInvoicedSummary } from '@/hooks/useBudgetsInvoicedSummary';
import { getEffectiveBudgetStatus, getBudgetStatusLabel } from '@/lib/budget-utils';

const invoicedLabel = (s?: BudgetInvoicedSummary) => {
  if (!s) return 'Sin facturar';
  if (s.percent <= 0) return 'Sin facturar';
  if (s.percent >= 99.5) return 'Facturado';
  return 'Parcial';
};

export const exportBudgetsToCSV = (
  budgets: any[],
  invoicedSummaries?: Map<string, BudgetInvoicedSummary>
) => {
  const headers = [
    'Código',
    'Título',
    'Cliente',
    'Origen',
    'Contacto',
    'PO Number',
    'Monto Total',
    'Importe Facturado',
    'Pendiente de Facturar',
    '% Facturado',
    'Estado Facturación',
    'Nº Facturas',
    'Hitos Facturados',
    'Próximo Hito',
    'Estado',
    'Fecha Facturación',
    'Fecha Creación',
  ];

  const rows = budgets.map((b) => {
    const s = invoicedSummaries?.get(b.id);
    const total = Number(b.total_amount || 0);
    const invoiced = s?.invoiced ?? 0;
    return [
      b.code || '-',
      b.title || '-',
      b.client?.name || '-',
      b.contract ? `Contrato: ${b.contract.title || b.contract.code || ''}`.trim() : 'Directo',
      b.client_contact?.name || '-',
      b.client_po_number || 'Pendiente',
      formatCurrency(total),
      formatCurrency(invoiced),
      formatCurrency(Math.max(total - invoiced, 0)),
      `${(s?.percent ?? 0).toFixed(1).replace('.', ',')}%`,
      invoicedLabel(s),
      s?.invoiceCount ?? 0,
      s && !s.isSynthetic ? `${s.milestonesCovered} de ${s.milestonesTotal}` : '-',
      s?.nextMilestoneLabel || '-',
      getBudgetStatusLabel(getEffectiveBudgetStatus(b.status, s)) || '-',
      formatDate(b.estimated_invoice_date),
      formatDate(b.created_at),
    ];
  });

  const totalAmount = budgets.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const totalInvoiced = budgets.reduce(
    (sum, b) => sum + (invoicedSummaries?.get(b.id)?.invoiced || 0),
    0
  );

  rows.push([]);
  rows.push([
    'TOTALES',
    `${budgets.length} presupuestos`,
    '',
    '',
    '',
    '',
    formatCurrency(totalAmount),
    formatCurrency(totalInvoiced),
    formatCurrency(Math.max(totalAmount - totalInvoiced, 0)),
    `${(totalAmount > 0 ? (totalInvoiced / totalAmount) * 100 : 0).toFixed(1).replace('.', ',')}%`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ]);

  const data = [headers, ...rows];
  const fileName = `presupuestos_${new Date().toISOString().split('T')[0]}`;
  downloadCSV(data, fileName, 'Presupuestos');
};
