import { Badge } from '@/components/ui/badge';
import { getFinancialRequestStatusColor, getFinancialRequestStatusLabel } from '@/lib/request-utils';
import { Database } from '@/integrations/supabase/types';

type FinancialRequestStatus = Database['public']['Enums']['financial_request_status'];

interface RequestStatusBadgeProps {
  status: FinancialRequestStatus;
  className?: string;
}

export const RequestStatusBadge = ({ status, className }: RequestStatusBadgeProps) => {
  return (
    <Badge className={`${getFinancialRequestStatusColor(status)} ${className || ''}`}>
      {getFinancialRequestStatusLabel(status)}
    </Badge>
  );
};
