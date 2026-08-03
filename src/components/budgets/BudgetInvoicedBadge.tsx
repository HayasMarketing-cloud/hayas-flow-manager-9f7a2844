import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/budget-utils';
import type { BudgetInvoicedSummary } from '@/hooks/useBudgetsInvoicedSummary';

interface BudgetInvoicedBadgeProps {
  summary?: BudgetInvoicedSummary;
  showProgress?: boolean;
}

const round = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? Math.round(n) : Number(n.toFixed(1)));

export function BudgetInvoicedBadge({ summary, showProgress = false }: BudgetInvoicedBadgeProps) {
  if (!summary) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  const pct = round(summary.percent);

  let label: string;
  let className: string;

  if (pct <= 0) {
    label = 'Sin facturar';
    className = 'bg-muted text-muted-foreground hover:bg-muted';
  } else if (pct >= 100.5) {
    label = `Sobrefacturado ${pct}%`;
    className = 'bg-destructive text-destructive-foreground hover:bg-destructive';
  } else if (pct >= 99.5) {
    label = 'Facturado 100%';
    className = 'bg-green-600 text-white hover:bg-green-600';
  } else {
    label = `Parcial ${pct}%`;
    className = 'bg-amber-500 text-white hover:bg-amber-500';
  }

  const milestoneLine = summary.isSynthetic
    ? null
    : `${summary.milestonesCovered} de ${summary.milestonesTotal} hitos emitidos${
        summary.nextMilestoneLabel
          ? ` · Próximo: ${summary.nextMilestoneLabel}${
              summary.nextMilestonePercentage ? ` (${summary.nextMilestonePercentage}%)` : ''
            }`
          : ''
      }`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="space-y-1 inline-block min-w-[110px]">
            <Badge className={className}>{label}</Badge>
            {showProgress && (
              <Progress value={Math.min(100, Math.max(0, summary.percent))} className="h-1.5" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-0.5">
            <p>
              {formatCurrency(summary.invoiced)} / {formatCurrency(summary.total)}
            </p>
            <p>
              {summary.invoiceCount} factura{summary.invoiceCount !== 1 ? 's' : ''} emitida
              {summary.invoiceCount !== 1 ? 's' : ''}
            </p>
            {milestoneLine && <p>{milestoneLine}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
