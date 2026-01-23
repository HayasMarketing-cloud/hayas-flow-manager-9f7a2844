import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { InvoiceStatusActions } from './InvoiceStatusActions';
import { Edit, Eye, FileText, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/invoice-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface InvoiceTableViewProps {
  invoices: any[];
  onView: (invoice: any) => void;
  onEdit: (invoice: any) => void;
  canManage: boolean;
}

export const InvoiceTableView = ({ invoices, onView, onEdit, canManage }: InvoiceTableViewProps) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Cliente</TableHead>
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
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                No hay facturas para mostrar
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.code}</TableCell>
                <TableCell>{invoice.client?.name || '-'}</TableCell>
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
                    {canManage && invoice.status === 'draft' && (
                      <Button variant="ghost" size="sm" onClick={() => onEdit(invoice)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canManage && <InvoiceStatusActions invoiceId={invoice.id} currentStatus={invoice.status} compact />}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
