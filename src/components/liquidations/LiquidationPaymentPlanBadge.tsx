import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/liquidation-utils';
import { getLiquidationPaymentPlanSummary } from '@/lib/liquidation-payment-plan';

interface Props {
  liquidation: any;
  total?: number;
  className?: string;
}

export const LiquidationPaymentPlanBadge = ({ liquidation, total, className }: Props) => {
  const base = Number(total ?? liquidation?.subtotal ?? liquidation?.total_amount ?? 0);
  const summary = getLiquidationPaymentPlanSummary(liquidation?.payment_plan, base);

  if (!summary.hasPlan) return null;

  if (summary.allPaid) {
    return (
      <Badge variant="outline" className={`border-green-500 text-green-700 dark:text-green-400 ${className ?? ''}`}>
        Plan de pagos completado
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`border-amber-500 text-amber-700 dark:text-amber-400 ${className ?? ''}`}
      title={
        summary.nextMilestone
          ? `Próximo pago: ${summary.nextMilestone.label} el ${summary.nextMilestone.payment_date}`
          : undefined
      }
    >
      Pago parcial {Math.round(summary.paidPercent)}% · pend. {formatCurrency(summary.pendingAmount)}
    </Badge>
  );
};
