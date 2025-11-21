import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { Edit, Eye } from 'lucide-react';
import { formatCurrency } from '@/lib/invoice-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
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
