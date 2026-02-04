import { Link } from 'react-router-dom';
import { useInvoiceLinkedRequests } from '@/hooks/useInvoiceLinkedRequests';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/liquidation-utils';

interface InvoiceLinkedRequestsTableProps {
  invoiceId: string;
}

export const InvoiceLinkedRequestsTable = ({ invoiceId }: InvoiceLinkedRequestsTableProps) => {
  const { data: requests, isLoading } = useInvoiceLinkedRequests(invoiceId);

  if (isLoading) {
    return (
      <Card className="p-4 space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  if (!requests || requests.length === 0) {
    return null;
  }

  const totalAmount = requests.reduce((sum, r) => sum + (r.sale_amount || 0), 0);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium">Solicitudes Vinculadas ({requests.length})</h3>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="hidden md:table-cell">Servicio</TableHead>
              <TableHead className="hidden lg:table-cell">Especialista</TableHead>
              <TableHead className="text-right w-[100px]">Importe</TableHead>
              <TableHead className="hidden sm:table-cell w-[100px]">Completado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((req) => (
              <TableRow key={req.id}>
                <TableCell>
                  <Link
                    to={`/solicitudes/${req.id}`}
                    className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {req.code}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </TableCell>
                <TableCell className="max-w-[200px] truncate" title={req.title}>
                  {req.title}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {req.service?.name || '-'}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {req.specialist?.name || '-'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(req.sale_amount || 0)}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                  {req.completed_at
                    ? format(new Date(req.completed_at), 'dd/MM/yy', { locale: es })
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="text-right font-medium">
                Total:
              </TableCell>
              <TableCell className="text-right font-bold">
                {formatCurrency(totalAmount)}
              </TableCell>
              <TableCell className="hidden sm:table-cell" />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </Card>
  );
};
