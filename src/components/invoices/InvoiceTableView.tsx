import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { InvoiceStatusActions } from './InvoiceStatusActions';
import { InvoiceOriginCell } from './InvoiceOriginCell';
import { Edit, Eye, FileText, AlertCircle, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/invoice-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OriginItem {
  id: string;
  name?: string;
  code?: string;
  title?: string;
}

// Helper functions to extract unique items from linked requests
const getUniqueProjects = (invoice: any): OriginItem[] => {
  if (!invoice.linked_requests) return [];
  const projects = invoice.linked_requests
    .flatMap((r: any) => r.operational_request || [])
    .map((or: any) => or.operational_project)
    .filter(Boolean);
  // Deduplicate by id
  return [...new Map(projects.map((p: any) => [p.id, p])).values()] as OriginItem[];
};

const getUniqueBudgets = (invoice: any): OriginItem[] => {
  if (!invoice.linked_requests) return [];
  const budgets = invoice.linked_requests
    .map((r: any) => r.budget)
    .filter(Boolean);
  return [...new Map(budgets.map((b: any) => [b.id, b])).values()] as OriginItem[];
};

const getUniqueContracts = (invoice: any): OriginItem[] => {
  if (!invoice.linked_requests) return [];
  const contracts = invoice.linked_requests
    .map((r: any) => r.contract)
    .filter(Boolean);
  return [...new Map(contracts.map((c: any) => [c.id, c])).values()] as OriginItem[];
};
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
  const selectableInvoices = invoices.filter(inv => isSelectableStatus(inv.status));
  const allSelected = selectableInvoices.length > 0 && selectableInvoices.every(inv => selectedIds.includes(inv.id));
  const someSelected = selectableInvoices.some(inv => selectedIds.includes(inv.id)) && !allSelected;

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
            <TableHead>Proyecto</TableHead>
            <TableHead>Presupuesto</TableHead>
            <TableHead>Contrato</TableHead>
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
              <TableCell colSpan={14} className="text-center text-muted-foreground">
                No hay facturas para mostrar
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((invoice) => {
              const canSelect = isSelectableStatus(invoice.status);
              const isSelected = selectedIds.includes(invoice.id);
              
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
                  <TableCell>
                    <InvoiceOriginCell items={getUniqueProjects(invoice)} type="project" />
                  </TableCell>
                  <TableCell>
                    <InvoiceOriginCell items={getUniqueBudgets(invoice)} type="budget" />
                  </TableCell>
                  <TableCell>
                    <InvoiceOriginCell items={getUniqueContracts(invoice)} type="contract" />
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
