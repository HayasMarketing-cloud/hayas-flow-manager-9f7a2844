import { Badge } from '@/components/ui/badge';
import { getBudgetStatusColor, getBudgetStatusLabel } from '@/lib/budget-utils';

interface BudgetStatusBadgeProps {
  status: string;
}

export const BudgetStatusBadge = ({ status }: BudgetStatusBadgeProps) => {
  return (
    <Badge className={getBudgetStatusColor(status)}>
      {getBudgetStatusLabel(status)}
    </Badge>
  );
};
