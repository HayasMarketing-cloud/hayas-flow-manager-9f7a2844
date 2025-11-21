import { Badge } from '@/components/ui/badge';
import { getRequestStatusColor, getRequestStatusLabel } from '@/lib/request-utils';
import { Database } from '@/integrations/supabase/types';

type RequestStatus = Database['public']['Enums']['request_status'];

interface RequestStatusBadgeProps {
  status: RequestStatus;
  className?: string;
}

export const RequestStatusBadge = ({ status, className }: RequestStatusBadgeProps) => {
  return (
    <Badge className={`${getRequestStatusColor(status)} ${className || ''}`}>
      {getRequestStatusLabel(status)}
    </Badge>
  );
};
