import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { InvoiceStatusActions } from './InvoiceStatusActions';
import { AllocationStatusBadge } from './AllocationStatusBadge';
import { Edit, Eye, FileText, AlertCircle, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/invoice-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useInvoiceAllocationSummaries } from '@/hooks/useInvoiceAllocationSummaries';
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

// Selectable = all invoices that are not paid (pending payment)
const isSelectableStatus = (status: string) => status !== 'paid';

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

  const selectableInvoices = invoices.filter(inv => isSelectableStatus(inv.status));
  const allSelected = selectableInvoices.length > 0 && selectableInvoices.every(inv => selectedIds.includes(inv.id));
  const someSelected = selectableInvoices.some(inv => selectedIds.includes(inv.id)) && !allSelected;

  const renderAssociation = (invoice: any) => {
    // Direct budget association
    if (invoice.budget_id && invoice.budget) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 cursor-pointer">
                {invoice.budget.code}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Presupuesto</p>
              <p className="text-sm">{invoice.budget.title}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // Direct contract association
    if (invoice.contract_id && invoice.contract) {
      const periodLabel = invoice.billing_period_month && invoice.billing_period_year
        ? `${months[invoice.billing_period_month - 1]} ${invoice.billing_period_year}`
        : '';
      
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col gap-1">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 cursor-pointer">
                  {invoice.contract.code}
                </Badge>
                {periodLabel && (
                  <span className="text-xs text-muted-foreground">{periodLabel}</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Contrato</p>
              <p className="text-sm">{invoice.contract.title}</p>
              {periodLabel && <p className="text-sm">Período: {periodLabel}</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // No association
    return <span className="text-muted-foreground text-sm">Sin asociar</span>;
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
