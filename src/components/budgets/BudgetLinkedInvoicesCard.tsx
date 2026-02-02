import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBudgetAllocations } from '@/hooks/useInvoiceBudgetAllocations';
import { BudgetAllocationStatus } from '@/components/invoices/AllocationStatusBadge';
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge';
import { formatCurrency } from '@/lib/budget-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, Receipt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BudgetLinkedInvoicesCardProps {
  budgetId: string;
  budgetTotal: number;
}

export function BudgetLinkedInvoicesCard({ budgetId, budgetTotal }: BudgetLinkedInvoicesCardProps) {
  const navigate = useNavigate();
  const { data: allocations, isLoading } = useBudgetAllocations(budgetId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Estado de Facturación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalInvoiced = (allocations || []).reduce((sum, a) => sum + Number(a.allocated_amount), 0);
  const hasAllocations = allocations && allocations.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Estado de Facturación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <BudgetAllocationStatus
          invoicedAmount={totalInvoiced}
          budgetTotal={budgetTotal}
        />

        {/* Invoice list */}
        {hasAllocations ? (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Importe Asignado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((allocation) => {
                  const invoice = allocation.invoice as any;
                  if (!invoice) return null;
                  
                  return (
                    <TableRow key={allocation.id}>
                      <TableCell className="font-medium">
                        {invoice.code}
                      </TableCell>
                      <TableCell>
                        {invoice.invoice_date 
                          ? format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: es })
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(allocation.allocated_amount)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/facturas`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay facturas vinculadas a este presupuesto.
          </p>
        )}

        {/* Summary line */}
        {hasAllocations && (
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              {allocations.length} factura{allocations.length !== 1 ? 's' : ''} vinculada{allocations.length !== 1 ? 's' : ''}
            </span>
            <span className="text-sm font-medium">
              Total facturado: {formatCurrency(totalInvoiced)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
