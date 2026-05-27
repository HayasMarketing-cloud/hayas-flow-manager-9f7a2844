import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { InvoiceStatusActions } from './InvoiceStatusActions';
import { InvoiceOriginCell } from './InvoiceOriginCell';
import { InlineInvoiceAssociation } from './InlineInvoiceAssociation';
import { Edit, Calendar, DollarSign, AlertCircle, FileText, Trash2 } from 'lucide-react';
import { formatCurrency, getDaysUntilDue } from '@/lib/invoice-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const months = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

interface InvoiceCardProps {
  invoice: any;
  onEdit: (invoice: any) => void;
  onDelete?: (invoice: any) => void;
  canManage: boolean;
}

export const InvoiceCard = ({ invoice, onEdit, onDelete, canManage }: InvoiceCardProps) => {
  const daysUntilDue = getDaysUntilDue(invoice.due_date);
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;

  const renderAssociation = () => {
    const allocations = invoice.invoice_budget_allocations || [];
    const budgetItems = allocations
      .filter((allocation: any) => allocation.budget)
      .map((allocation: any) => ({
        id: allocation.budget.id,
        code: allocation.budget.code,
        title: allocation.budget.title,
      }));

    if (budgetItems.length > 0) {
      return <InvoiceOriginCell items={budgetItems} type="budget" />;
    }

    if (invoice.budget_id && invoice.budget) {
      return <InvoiceOriginCell items={[invoice.budget]} type="budget" />;
    }

    if (invoice.contract_id && invoice.contract) {
      const periodLabel = invoice.billing_period_month && invoice.billing_period_year
        ? `${months[invoice.billing_period_month - 1]} ${invoice.billing_period_year}`
        : '';

      return (
        <div className="flex flex-col gap-1">
          <InvoiceOriginCell items={[invoice.contract]} type="contract" />
          {periodLabel && <span className="text-xs text-muted-foreground pl-5">{periodLabel}</span>}
        </div>
      );
    }

    return (
      <InlineInvoiceAssociation
        invoiceId={invoice.id}
        clientId={invoice.client_id}
        subtotal={Number(invoice.subtotal || 0)}
      />
    );
  };

  return (
    <Card className={`hover:shadow-lg transition-shadow ${isOverdue ? 'border-red-500' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{invoice.code}</CardTitle>
            {invoice.client && (
              <p className="text-sm text-muted-foreground mt-1">{invoice.client.name}</p>
            )}
          </div>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span>
            {format(new Date(invoice.invoice_date), 'dd MMM yyyy', { locale: es })}
          </span>
        </div>
        
        {invoice.due_date && (
          <div className={`flex items-center gap-2 text-sm ${isOverdue ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
            {isOverdue && <AlertCircle className="h-4 w-4 flex-shrink-0" />}
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span>
              Vence: {format(new Date(invoice.due_date), 'dd MMM yyyy', { locale: es })}
              {daysUntilDue !== null && (
                <span className="ml-1">
                  ({isOverdue ? `${Math.abs(daysUntilDue)} días vencida` : `${daysUntilDue} días`})
                </span>
              )}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DollarSign className="h-4 w-4 flex-shrink-0" />
          <span className="font-semibold text-foreground">
            {formatCurrency(invoice.total_amount)}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-2">
          <span className="text-xs text-muted-foreground">Asociación</span>
          <div className="min-w-0 text-right">{renderAssociation()}</div>
        </div>

        {invoice.pdf_url ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(invoice.pdf_url, '_blank')}
            className="w-full"
          >
            <FileText className="h-4 w-4 mr-2" />
            Ver Copia PDF
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Sin copia adjunta</span>
          </div>
        )}

        <div className="pt-2 space-y-2">
          {canManage && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(invoice)}
                className="flex-1"
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(invoice)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          {canManage && (
            <InvoiceStatusActions invoiceId={invoice.id} currentStatus={invoice.status} />
          )}
        </div>
      </CardContent>
    </Card>
  );
};
