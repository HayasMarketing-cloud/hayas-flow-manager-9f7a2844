import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { BudgetAllocationStatus } from '@/components/invoices/AllocationStatusBadge';
import { useBudgetMilestoneBreakdown } from '@/hooks/useBudgetMilestoneResolver';
import { formatCurrency } from '@/lib/budget-utils';
import { Receipt, ArrowRight } from 'lucide-react';

interface BudgetInvoicingSummaryProps {
  budgetId: string;
  budgetTotal: number;
  onOpenControlling?: () => void;
}

export function BudgetInvoicingSummary({
  budgetId,
  budgetTotal,
  onOpenControlling,
}: BudgetInvoicingSummaryProps) {
  const { data, isLoading } = useBudgetMilestoneBreakdown(budgetId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { totalInvoiced, percentCovered, milestones, additional, plan, isSynthetic } = data;
  const emitted =
    milestones.filter((m) => m.match).length + additional.length;
  const remainingMilestones = milestones.filter((m) => !m.match).length;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Estado de facturación</span>
          </div>
          <BudgetAllocationStatus
            invoicedAmount={totalInvoiced}
            budgetTotal={budgetTotal}
          />
        </div>

        <div className="space-y-1">
          <Progress value={Math.min(100, percentCovered)} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {formatCurrency(totalInvoiced)} / {formatCurrency(budgetTotal)}
            </span>
            <span>{percentCovered.toFixed(1)}%</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {isSynthetic
              ? `1 hito (100%) · ${emitted} factura${emitted !== 1 ? 's' : ''} emitida${emitted !== 1 ? 's' : ''}`
              : `${plan.length} hitos · ${emitted} emitida${emitted !== 1 ? 's' : ''}${
                  remainingMilestones > 0 ? ` · ${remainingMilestones} pendiente${remainingMilestones !== 1 ? 's' : ''}` : ''
                }${additional.length > 0 ? ` · ${additional.length} adicional${additional.length !== 1 ? 'es' : ''}` : ''}`}
          </span>
          {onOpenControlling && (
            <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={onOpenControlling}>
              Ver detalle
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
