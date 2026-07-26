import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { InvoiceStatusActions } from './InvoiceStatusActions';
import { B2BRouterEmitButton } from './B2BRouterEmitButton';
import { AllocationStatusBadge } from './AllocationStatusBadge';
import { InvoiceOriginCell } from './InvoiceOriginCell';
import { InlineInvoiceAssociation } from './InlineInvoiceAssociation';
import { Edit, Eye, FileText, AlertCircle, Trash2, Milestone } from 'lucide-react';
import { formatCurrency } from '@/lib/invoice-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useInvoiceAllocationSummaries } from '@/hooks/useInvoiceAllocationSummaries';
import { useInvoiceListMilestoneResolver } from '@/hooks/useBudgetMilestoneResolver';
import { useMemo } from 'react';

interface InvoiceTableViewProps {
  invoices: any[];
  onView: (invoice: any) => void;
  onEdit: (invoice: any) => void;
  onDelete?: (invoice: any) => void;
  canManage: boolean;
  selectedIds: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
}

// All invoices can be selected (including paid ones for reverting)
const isSelectableStatus = (status: string) => true;

const months = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export const InvoiceTableView = ({
  invoices,
  onView,
  onEdit,
  onDelete,
  canManage,
  selectedIds,
  onSelectAll,
  onSelectOne
}: InvoiceTableViewProps) => {
  // Get allocation summaries for all invoices
  const invoiceIds = useMemo(() => invoices.map(inv => inv.id), [invoices]);
  const { data: allocationSummaries } = useInvoiceAllocationSummaries(invoiceIds);
  const { data: milestoneMap } = useInvoiceListMilestoneResolver(invoices);

  const selectableInvoices = invoices.filter(inv => isSelectableStatus(inv.status));
  const allSelected = selectableInvoices.length > 0 && selectableInvoices.every(inv => selectedIds.includes(inv.id));
  const someSelected = selectableInvoices.some(inv => selectedIds.includes(inv.id)) && !allSelected;

  const renderMilestoneBadges = (invoice: any) => {
    const matches = milestoneMap?.get(invoice.id);
    if (!matches || matches.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {matches.map((m) => {
          const isAdditional = m.matchType === 'additional';
          const pct = Math.round(
            isAdditional ? m.allocationPercentage : m.milestonePercentage
          );
          const label = isAdditional
            ? `+ ${m.milestoneLabel}`
            : `${pct}% · ${m.milestoneLabel}`;
          return (
            <TooltipProvider key={`${m.budgetId}-${m.milestoneIndex}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={
                      isAdditional
                        ? 'gap-1 border-amber-300 bg-amber-50 text-amber-800 text-[10px] py-0'
                        : m.matchType === 'fallback'
                          ? 'gap-1 border-blue-200 bg-blue-50 text-blue-800 text-[10px] py-0'
                          : 'gap-1 border-primary/30 bg-primary/5 text-primary text-[10px] py-0'
                    }
                  >
                    <Milestone className="h-2.5 w-2.5" />
                    {label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs space-y-0.5">
                    <p className="font-medium">
                      {m.budgetCode} · {m.milestoneLabel}
                    </p>
                    <p>Hito: {m.milestonePercentage}% del presupuesto</p>
                    <p>Factura: {m.allocationPercentage.toFixed(1)}% ({formatCurrency(m.allocatedAmount)})</p>
                    <p className="text-muted-foreground">
                      {m.matchType === 'index' && 'Vinculación explícita (source_milestone_index).'}
                      {m.matchType === 'fallback' && 'Vinculación deducida por % y fecha.'}
                      {m.matchType === 'single-100' && 'Presupuesto sin plan de pagos — hito único 100%.'}
                      {m.matchType === 'additional' && 'Factura extra: sin hueco de hito disponible.'}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    );
  };

  const renderAssociation = (invoice: any) => {
    // First check for budget allocations (N:M relationship - preferred method)
    const allocations = invoice.invoice_budget_allocations || [];
    if (allocations.length > 0) {
      const budgetItems = allocations
        .filter((a: any) => a.budget)
        .map((a: any) => ({
          id: a.budget.id,
          code: a.budget.code,
          title: a.budget.title,
        }));

      if (budgetItems.length > 0) {
        return (
          <div className="flex flex-col gap-0.5">
            <InvoiceOriginCell items={budgetItems} type="budget" />
            {renderMilestoneBadges(invoice)}
          </div>
        );
      }
    }

    // Direct budget association (legacy)
    if (invoice.budget_id && invoice.budget) {
      return (
        <div className="flex flex-col gap-0.5">
          <InvoiceOriginCell items={[invoice.budget]} type="budget" />
          {renderMilestoneBadges(invoice)}
        </div>
      );
    }

    // Direct contract association
    if (invoice.contract_id && invoice.contract) {
      const periodLabel = invoice.billing_period_month && invoice.billing_period_year
        ? `${months[invoice.billing_period_month - 1]} ${invoice.billing_period_year}`
        : '';

      return (
        <div className="flex flex-col gap-1">
          <InvoiceOriginCell items={[invoice.contract]} type="contract" />
          {periodLabel && (
            <span className="text-xs text-muted-foreground">{periodLabel}</span>
          )}
        </div>
      );
    }

    // No association — inline editor with auto-match suggestion
    return (
      <InlineInvoiceAssociation
        invoiceId={invoice.id}
        clientId={invoice.client_id}
        subtotal={Number(invoice.subtotal || 0)}
      />
    );
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
                aria-label="Seleccionar todas"
                className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
              />
            </TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Asociación</TableHead>
            <TableHead>Conciliación</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead className="text-right">Subtotal</TableHead>
            <TableHead className="text-right">IVA</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-center">PDF</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={13} className="text-center text-muted-foreground">
                No hay facturas para mostrar
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((invoice) => {
              const canSelect = isSelectableStatus(invoice.status);
              const isSelected = selectedIds.includes(invoice.id);
              const allocationSummary = allocationSummaries?.get(invoice.id);

              return (
                <TableRow key={invoice.id} className={isSelected ? 'bg-muted/50' : ''}>
                  <TableCell>
                    {canSelect ? (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => onSelectOne(invoice.id, !!checked)}
                        aria-label={`Seleccionar ${invoice.code}`}
                      />
                    ) : (
                      <Checkbox disabled className="opacity-30" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{invoice.code}</TableCell>
                  <TableCell>{invoice.client?.name || '-'}</TableCell>
                  <TableCell>{renderAssociation(invoice)}</TableCell>
                  <TableCell>
                    {allocationSummary && allocationSummary.allocation_count > 0 ? (
                      <AllocationStatusBadge
                        percentage={allocationSummary.percentage}
                        allocatedAmount={allocationSummary.total_allocated}
                        totalAmount={invoice.total_amount}
                        compact
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>
                    {invoice.due_date
                      ? format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: es })
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(invoice.subtotal)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(invoice.tax_amount)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(invoice.total_amount)}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {invoice.pdf_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(invoice.pdf_url, '_blank')}
                              className="text-primary hover:text-primary/80"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">
                              <AlertCircle className="h-4 w-4 mx-auto" />
                            </span>
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          {invoice.pdf_url ? 'Ver copia PDF' : 'Sin copia adjunta'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onView(invoice)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canManage && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(invoice)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canManage && onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(invoice)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {canManage && (
                        <B2BRouterEmitButton
                          invoiceId={invoice.id}
                          status={invoice.status}
                          b2brouterInvoiceId={invoice.b2brouter_invoice_id}
                          b2brouterStatus={invoice.b2brouter_status}
                        />
                      )}
                      {canManage && <InvoiceStatusActions invoiceId={invoice.id} currentStatus={invoice.status} compact />}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
