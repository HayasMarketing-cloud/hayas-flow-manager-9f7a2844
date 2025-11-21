import { Badge } from '@/components/ui/badge';
import { getLiquidationStatusColor, getLiquidationStatusLabel } from '@/lib/liquidation-utils';
import { Database } from '@/integrations/supabase/types';

type LiquidationStatus = Database['public']['Enums']['liquidation_status'];

interface LiquidationStatusBadgeProps {
  status: LiquidationStatus;
}

export const LiquidationStatusBadge = ({ status }: LiquidationStatusBadgeProps) => {
  return (
    <Badge className={getLiquidationStatusColor(status)}>
      {getLiquidationStatusLabel(status)}
    </Badge>
  );
};
