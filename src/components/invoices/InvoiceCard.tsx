import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { InvoiceStatusActions } from './InvoiceStatusActions';
import { Edit, Calendar, DollarSign, AlertCircle, FileText } from 'lucide-react';
import { formatCurrency, getDaysUntilDue } from '@/lib/invoice-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InvoiceCardProps {
  invoice: any;
  onEdit: (invoice: any) => void;
  canManage: boolean;
}

export const InvoiceCard = ({ invoice, onEdit, canManage }: InvoiceCardProps) => {
  const daysUntilDue = getDaysUntilDue(invoice.due_date);
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(invoice)}
              className="w-full"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          {canManage && (
            <InvoiceStatusActions invoiceId={invoice.id} currentStatus={invoice.status} />
          )}
        </div>
      </CardContent>
    </Card>
  );
};
