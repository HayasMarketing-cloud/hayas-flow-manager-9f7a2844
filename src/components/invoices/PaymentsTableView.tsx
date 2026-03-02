import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/invoice-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { CreditCard, Banknote, ArrowRight } from 'lucide-react';

const paymentMethodLabels: Record<string, string> = {
  bank_transfer: 'Transferencia',
  credit_card: 'Tarjeta',
  stripe: 'Stripe',
  sdd: 'Domiciliación',
};

export const PaymentsTableView = () => {
  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments-with-invoices'],
    queryFn: async () => {
      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .order('payment_date', { ascending: false });
      if (paymentsError) throw paymentsError;

      // Fetch all invoice_payments links
      const paymentIds = paymentsData.map(p => p.id);
      if (paymentIds.length === 0) return [];

      const { data: links, error: linksError } = await supabase
        .from('invoice_payments')
        .select('payment_id, invoice_id, allocated_amount')
        .in('payment_id', paymentIds);
      if (linksError) throw linksError;

      // Fetch invoice details
      const invoiceIds = [...new Set(links.map(l => l.invoice_id))];
      let invoicesMap = new Map<string, { id: string; code: string; client: { name: string } | null; total_amount: number }>();
      if (invoiceIds.length > 0) {
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('id, code, total_amount, client:clients(name)')
          .in('id', invoiceIds);
        invoicesMap = new Map((invoicesData || []).map((i: any) => [i.id, i]));
      }

      // Group links by payment
      const linksByPayment = new Map<string, Array<{ invoice_id: string; allocated_amount: number }>>();
      for (const link of links) {
        const arr = linksByPayment.get(link.payment_id) || [];
        arr.push(link);
        linksByPayment.set(link.payment_id, arr);
      }

      return paymentsData.map(payment => ({
        ...payment,
        invoiceLinks: (linksByPayment.get(payment.id) || []).map(link => ({
          ...link,
          invoice: invoicesMap.get(link.invoice_id) || null,
        })),
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!payments?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CreditCard className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">No hay cobros registrados</p>
        <p className="text-sm">Los cobros aparecerán aquí cuando concilies facturas.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Referencia</TableHead>
            <TableHead className="text-right">Importe</TableHead>
            <TableHead>Facturas vinculadas</TableHead>
            <TableHead>Notas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map(payment => (
            <TableRow key={payment.id}>
              <TableCell className="font-mono font-medium text-sm">
                {payment.code}
              </TableCell>
              <TableCell className="text-sm">
                {format(new Date(payment.payment_date), 'dd MMM yyyy', { locale: es })}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {paymentMethodLabels[payment.payment_method || ''] || payment.payment_method || '-'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                {payment.reference || '-'}
              </TableCell>
              <TableCell className="text-right font-medium text-sm">
                {formatCurrency(payment.amount)}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {payment.invoiceLinks.map((link: any) => (
                    <div key={link.invoice_id} className="flex items-center gap-1.5 text-xs">
                      <Link
                        to="#"
                        onClick={(e) => e.preventDefault()}
                        className="font-mono text-primary hover:underline"
                      >
                        {link.invoice?.code || 'N/A'}
                      </Link>
                      {link.invoice?.client?.name && (
                        <span className="text-muted-foreground truncate max-w-[120px]">
                          ({link.invoice.client.name})
                        </span>
                      )}
                      <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      <span className="font-medium">{formatCurrency(link.allocated_amount)}</span>
                    </div>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                {payment.notes || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
