import { Badge } from '@/components/ui/badge';
import { 
  getFinancialRequestStatusColor, 
  getFinancialRequestStatusLabel,
  getVirtualRequestStatusColor,
  getVirtualRequestStatusLabel
} from '@/lib/request-utils';
import { Database } from '@/integrations/supabase/types';

type FinancialRequestStatus = Database['public']['Enums']['financial_request_status'];

interface RequestStatusBadgeProps {
  status: FinancialRequestStatus;
  className?: string;
  isLiquidated?: boolean;
}

export const RequestStatusBadge = ({ status, className, isLiquidated }: RequestStatusBadgeProps) => {
  // Show "Liquidado" virtual status when request has liquidation_id
  if (isLiquidated) {
    return (
      <Badge className={`${getVirtualRequestStatusColor('liquidated')} ${className || ''}`}>
        {getVirtualRequestStatusLabel('liquidated')}
      </Badge>
    );
  }

  return (
    <Badge className={`${getFinancialRequestStatusColor(status)} ${className || ''}`}>
      {getFinancialRequestStatusLabel(status)}
    </Badge>
  );
};
