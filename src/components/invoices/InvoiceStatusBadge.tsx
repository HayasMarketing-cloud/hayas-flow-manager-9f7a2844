import { Badge } from '@/components/ui/badge';
import { getInvoiceStatusColor, getInvoiceStatusLabel } from '@/lib/invoice-utils';
import { Database } from '@/integrations/supabase/types';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

export const InvoiceStatusBadge = ({ status }: InvoiceStatusBadgeProps) => {
  return (
    <Badge className={getInvoiceStatusColor(status)}>
      {getInvoiceStatusLabel(status)}
    </Badge>
  );
};
