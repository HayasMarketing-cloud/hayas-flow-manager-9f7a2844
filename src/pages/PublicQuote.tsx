import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, FileDown, AlertCircle, Receipt, Calendar, FileText, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateBudgetPDF } from '@/utils/pdf/budgetPDFGenerator';
import { resolveMilestonesForBudget, type PaymentMilestone } from '@/hooks/useBudgetMilestoneResolver';
import { getMilestoneAmount, getMilestoneBase } from '@/lib/budget-utils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: true, minimumFractionDigits: 2 }).format(amount);
};

const invoiceStatusLabelEn: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};



interface GroupedCategory {
  categoryName: string;
  items: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
  subtotal: number;
}

const groupItemsByCategory = (items: any[]): GroupedCategory[] => {
  const grouped: Record<string, { items: any[]; subtotal: number }> = {};
  items.forEach((item) => {
    const cat = item.service?.category || item.service?.name || 'Otros servicios';
    if (!grouped[cat]) grouped[cat] = { items: [], subtotal: 0 };
    grouped[cat].items.push(item);
    grouped[cat].subtotal += item.total;
  });
  return Object.entries(grouped).map(([categoryName, data]) => ({
    categoryName,
    items: data.items,
    subtotal: data.subtotal,
  }));
};

export default function PublicQuote() {
  const { token } = useParams<{ token: string }>();

  // Kill-switch: si un cliente tiene un Service Worker antiguo cacheando este
  // bundle, lo desregistramos y limpiamos cachés para que siempre vea la
  // última versión del presupuesto. Solo se ejecuta una vez por carga.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const FLAG = 'quote-sw-cleaned-v1';
    if (sessionStorage.getItem(FLAG)) return;

    (async () => {
      try {
        let didUnregister = false;
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            await reg.unregister();
            didUnregister = true;
          }
        }
        if (typeof caches !== 'undefined') {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
        sessionStorage.setItem(FLAG, '1');
        if (didUnregister) {
          // Recarga limpia para servir el bundle nuevo desde el origen
          window.location.reload();
        }
      } catch {
        sessionStorage.setItem(FLAG, '1');
      }
    })();
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-quote', token],
    queryFn: async () => {
      // Detect if it's a UUID (old format) or short_code (new format)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token || '');
      const param = isUuid ? `token=${token}` : `code=${token}`;
      
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/get-public-quote?${param}`,
        { headers: { apikey: SUPABASE_ANON_KEY }, cache: 'no-store' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Error al cargar el presupuesto');
      }
      return res.json();
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#00467E]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-800">Enlace no válido</h2>
          <p className="text-gray-600">{(error as Error)?.message || 'Este enlace no es válido o ha expirado.'}</p>
        </div>
      </div>
    );
  }

  const { budget, items, allocations = [] } = data;
  const client = budget.client;
  const groupedItems = groupItemsByCategory(items);
  const total = budget.total_amount || items.reduce((sum: number, i: any) => sum + i.total, 0);

  const totalInvoiced = allocations.reduce((sum: number, a: any) => sum + Number(a.allocated_amount), 0);
  const pending = Math.max(total - totalInvoiced, 0);
  const invoicedPct = total > 0 ? Math.round((totalInvoiced / total) * 100) : 0;
  const billingState: 'none' | 'partial' | 'full' =
    totalInvoiced <= 0 ? 'none' : totalInvoiced >= total ? 'full' : 'partial';

  const formatDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null;

  // ---- Payment plan (milestones) resolved against real invoices ----
  const plan: PaymentMilestone[] = Array.isArray(budget.payment_plan)
    ? (budget.payment_plan as PaymentMilestone[])
    : [];
  const hasPlan = plan.length > 0;

  const invoiceMeta = new Map<string, any>();
  allocations.forEach((a: any) => {
    if (a.invoice) invoiceMeta.set(a.invoice.id, a.invoice);
  });

  const milestoneMatches = hasPlan
    ? resolveMilestonesForBudget(
        total,
        plan,
        allocations.map((a: any) => ({
          invoice_id: a.invoice.id,
          budget_id: budget.id,
          allocated_amount: Number(a.allocated_amount),
          invoice_date: a.invoice.invoice_date ?? null,
          source_milestone_index: a.invoice.source_milestone_index ?? null,
          invoice_budget_id: a.invoice.budget_id ?? null,
        }))
      )
    : new Map();

  const matchByMilestone = new Map<number, any>();
  const additionalInvoices: any[] = [];
  for (const [key, m] of milestoneMatches.entries()) {
    const invoiceId = key.split('::')[0];
    const enriched = { ...m, invoice: invoiceMeta.get(invoiceId) };
    if (m.milestoneIndex >= 0) matchByMilestone.set(m.milestoneIndex, enriched);
    else additionalInvoices.push(enriched);
  }

  const milestoneRows = plan.map((m, index) => {
    const match = matchByMilestone.get(index) || null;
    const inv = match?.invoice;
    return {
      index,
      label: m.label,
      poNumber: m.po_number || null,
      base: getMilestoneBase(m, total),
      percentage: Number(m.percentage) || 0,
      amount: getMilestoneAmount(m, total),
      plannedDate: m.invoice_date || null,
      invoiceCode: inv?.code || null,
      invoiceDate: inv?.invoice_date || null,
      invoiceStatus: inv?.status || null,
      invoicePdfUrl: inv?.pdf_url || null,
      invoicedAmount: match ? Number(match.allocatedAmount) : 0,
    };
  });

  const handleDownloadPDF = () => {
    generateBudgetPDF({
      budget: { ...budget, client, requested_by: budget.requested_by },
      items,
      milestones: hasPlan
        ? milestoneRows.map((r) => ({
            label: r.label,
            poNumber: r.poNumber,
            base: r.base,
            percentage: r.percentage,
            amount: r.amount,
            date: r.invoiceDate || r.plannedDate,
            invoiceCode: r.invoiceCode,
            status: r.invoiceCode
              ? invoiceStatusLabelEn[r.invoiceStatus || ''] || r.invoiceStatus || 'Invoiced'
              : 'Pending',
          }))
        : undefined,
    });
  };


  const validUntilFormatted = budget.valid_until
    ? new Date(budget.valid_until).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const estimatedInvoiceFormatted = formatDate(budget.estimated_invoice_date);

  const invoiceStatusLabel: Record<string, string> = {
    draft: 'Borrador',
    pending: 'Pendiente',
    sent: 'Enviada',
    paid: 'Cobrada',
    overdue: 'Vencida',
    cancelled: 'Cancelada',
  };

  const invoiceStatusClass: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-[#00467E] text-white p-8">
          <div className="flex items-start justify-between">
            <div>
              <img src="/images/hayas-logo-white.png" alt="Hayas Marketing" className="h-40 mb-4" />
              <p className="text-sm opacity-80">APPS 4 BUSINESS SL</p>
              <p className="text-sm opacity-80">C/Manzanares 4 - 28005 Madrid</p>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-bold mb-2">QUOTE</h1>
              <p className="text-lg">{budget.quote_code || budget.code}</p>
              <p className="text-sm opacity-80 mt-1">{client.name}</p>
            </div>
          </div>
        </div>

        {/* Quote info */}
        <div className="p-8 border-b">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-500 text-sm uppercase mb-2">Client</h3>
              <p className="font-semibold text-lg">{client.name}</p>
              {budget.requested_by && (
                <p className="text-gray-600 mt-1">Requested by: {budget.requested_by}</p>
              )}
            </div>
            <div className="text-right">
              {validUntilFormatted && (
                <div>
                  <h3 className="font-semibold text-gray-500 text-sm uppercase mb-2">Valid until</h3>
                  <p className="text-gray-800">{validUntilFormatted}</p>
                </div>
              )}
              {budget.client_po_number && budget.client_po_number !== 'Pendiente' && (
                <div className="mt-4">
                  <h3 className="font-semibold text-gray-500 text-sm uppercase mb-2">PO / Reference</h3>
                  <p className="text-gray-800">{budget.client_po_number}</p>
                </div>
              )}
            </div>
          </div>

          {/* Title and description */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-gray-800">{budget.title}</h2>
            {budget.description && (
              <p className="text-gray-600 mt-2 whitespace-pre-line">{budget.description}</p>
            )}
          </div>
        </div>

        {/* Items table grouped by category */}
        <div className="p-8">
          {groupedItems.map((group) => (
            <div key={group.categoryName} className="mb-6">
              <div className="flex justify-between items-center bg-gray-100 px-4 py-2 rounded-t font-semibold text-sm">
                <span>{group.categoryName}</span>
                <span>{formatCurrency(group.subtotal)}</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b text-xs text-gray-500 uppercase">
                    <th className="text-left py-2 px-4">Description</th>
                    <th className="text-center py-2 px-4 w-20">Qty</th>
                    <th className="text-right py-2 px-4 w-28">Unit Price</th>
                    <th className="text-right py-2 px-4 w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-sm">{item.description}</td>
                      <td className="py-3 px-4 text-sm text-center">{item.quantity}</td>
                      <td className="py-3 px-4 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="py-3 px-4 text-sm text-right font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Total */}
          <div className="flex justify-end mt-4 pt-4 border-t-2 border-[#00467E]">
            <div className="text-right">
              <span className="text-gray-500 text-sm uppercase mr-8">Total</span>
              <span className="text-2xl font-bold text-[#00467E]">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Payment plan */}
        {hasPlan && (
          <div className="px-8 pb-8">
            <div className="border rounded-lg bg-white">
              <div className="px-6 py-4 border-b flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-[#00467E]" />
                <h3 className="font-semibold text-gray-800">Payment plan</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
                      <th className="text-left py-2 px-4">Milestone</th>
                      <th className="text-left py-2 px-4">PO / Ref.</th>
                      <th className="text-left py-2 px-4">Date</th>
                      <th className="text-right py-2 px-4">%</th>
                      <th className="text-right py-2 px-4">Amount</th>
                      <th className="text-left py-2 px-4">Invoice</th>
                      <th className="text-left py-2 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestoneRows.map((row) => (
                      <tr key={row.index} className="border-b border-gray-100 align-top">
                        <td className="py-3 px-4 text-sm font-medium">{row.label}</td>
                        <td className="py-3 px-4 text-sm">{row.poNumber || '—'}</td>
                        <td className="py-3 px-4 text-sm">
                          {formatDate(row.invoiceDate || row.plannedDate) || '—'}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          {Math.round(row.percentage * 100) / 100}%
                          {row.base !== total && (
                            <span className="block text-xs text-gray-400">
                              on {formatCurrency(row.base)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {row.invoiceCode ? (
                            row.invoicePdfUrl ? (
                              <a
                                href={row.invoicePdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#00467E] hover:underline inline-flex items-center gap-1"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                {row.invoiceCode}
                              </a>
                            ) : (
                              row.invoiceCode
                            )
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {row.invoiceCode ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                invoiceStatusClass[row.invoiceStatus || ''] || 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {invoiceStatusLabelEn[row.invoiceStatus || ''] || row.invoiceStatus}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-t text-sm">
                <span className="text-gray-500">
                  {milestoneRows.filter((r) => r.invoiceCode).length} of {milestoneRows.length} milestones invoiced
                </span>
                <span className="font-medium text-gray-800">
                  Planned total: {formatCurrency(milestoneRows.reduce((s, r) => s + r.amount, 0))}
                </span>
              </div>
            </div>
          </div>
        )}



        {/* Estado de Facturación / Billing Status */}
        <div className="px-8 pb-8">
          <div className="border rounded-lg bg-white">
            <div className="px-6 py-4 border-b flex items-center gap-2">
              <Receipt className="h-5 w-5 text-[#00467E]" />
              <h3 className="font-semibold text-gray-800">Billing Status</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Estimated invoice date:</span>
                {estimatedInvoiceFormatted ? (
                  <span className="font-medium text-gray-800">{estimatedInvoiceFormatted}</span>
                ) : (
                  <span className="italic text-gray-400">Not specified</span>
                )}
              </div>

              <div className="space-y-2">
                <div>
                  {billingState === 'none' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      Not invoiced yet
                    </span>
                  )}
                  {billingState === 'partial' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Partially invoiced
                    </span>
                  )}
                  {billingState === 'full' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Fully invoiced
                    </span>
                  )}
                </div>
                {billingState !== 'none' && (
                  <p className="text-sm text-gray-600">
                    {formatCurrency(totalInvoiced)} / {formatCurrency(total)} ({invoicedPct}%)
                    {pending > 0 && <> • Pending: {formatCurrency(pending)}</>}
                  </p>
                )}
              </div>

              {allocations.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
                        <th className="text-left py-2 px-4">Invoice</th>
                        <th className="text-left py-2 px-4">Date</th>
                        <th className="text-right py-2 px-4">Allocated</th>
                        <th className="text-left py-2 px-4">Status</th>
                        <th className="text-center py-2 px-4 w-16">Doc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((a: any) => {
                        const inv = a.invoice;
                        return (
                          <tr key={a.id} className="border-b border-gray-100">
                            <td className="py-3 px-4 text-sm font-medium">{inv.code}</td>
                            <td className="py-3 px-4 text-sm">{formatDate(inv.invoice_date) || '-'}</td>
                            <td className="py-3 px-4 text-sm text-right font-medium">
                              {formatCurrency(Number(a.allocated_amount))}
                            </td>
                            <td className="py-3 px-4 text-sm">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  invoiceStatusClass[inv.status] || 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {invoiceStatusLabel[inv.status] || inv.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {inv.pdf_url ? (
                                <a
                                  href={inv.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center text-[#00467E] hover:text-[#003562]"
                                  aria-label="View invoice document"
                                >
                                  <FileText className="h-4 w-4" />
                                </a>
                              ) : (
                                <FileText className="h-4 w-4 text-gray-300 inline" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-t text-sm">
                    <span className="text-gray-500">
                      {allocations.length} invoice{allocations.length !== 1 ? 's' : ''} linked
                    </span>
                    <span className="font-medium text-gray-800">
                      Total invoiced: {formatCurrency(totalInvoiced)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No invoices linked to this quote yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-8 bg-gray-50 border-t flex justify-center">
          <Button onClick={handleDownloadPDF} className="bg-[#00467E] hover:bg-[#003562]">
            <FileDown className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>

        {/* Footer */}
        <div className="p-4 text-center text-xs text-gray-400">
          This quote is valid until the date indicated • HAYAS MARKETING
        </div>
      </div>
    </div>
  );
}
