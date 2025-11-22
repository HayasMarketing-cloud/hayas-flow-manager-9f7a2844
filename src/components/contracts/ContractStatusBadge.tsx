import { Badge } from '@/components/ui/badge';
import { getContractStatusColor, getContractStatusLabel } from '@/lib/contract-utils';

interface ContractStatusBadgeProps {
  status: string;
}

export const ContractStatusBadge = ({ status }: ContractStatusBadgeProps) => {
  return (
    <Badge className={getContractStatusColor(status)}>
      {getContractStatusLabel(status)}
    </Badge>
  );
};
