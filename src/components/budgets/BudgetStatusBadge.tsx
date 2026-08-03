import { Badge } from '@/components/ui/badge';
import {
  getBudgetStatusColor,
  getBudgetStatusLabel,
  getEffectiveBudgetStatus,
} from '@/lib/budget-utils';
import type { BudgetInvoicedSummary } from '@/hooks/useBudgetsInvoicedSummary';

interface BudgetStatusBadgeProps {
  status: string;
  /** Si se proporciona, el estado facturado se deriva de la facturación real. */
  invoicedSummary?: BudgetInvoicedSummary | null;
}

export const BudgetStatusBadge = ({ status, invoicedSummary }: BudgetStatusBadgeProps) => {
  const effective = getEffectiveBudgetStatus(status, invoicedSummary);

  return (
    <Badge className={getBudgetStatusColor(effective)}>
      {getBudgetStatusLabel(effective)}
    </Badge>
  );
};
