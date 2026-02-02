import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Circle, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/invoice-utils';

interface AllocationStatusBadgeProps {
  percentage: number;
  allocatedAmount: number;
  totalAmount: number;
  compact?: boolean;
}

export function AllocationStatusBadge({ 
  percentage, 
  allocatedAmount, 
  totalAmount,
  compact = false 
}: AllocationStatusBadgeProps) {
  const getStatus = () => {
    if (percentage === 0) {
      return {
        label: 'Sin asignar',
        icon: Circle,
        className: 'bg-muted text-muted-foreground border-muted',
        color: 'text-muted-foreground',
      };
    }
    if (percentage > 100) {
      return {
        label: 'Exceso',
        icon: AlertTriangle,
        className: 'bg-red-50 text-red-700 border-red-200',
        color: 'text-red-600',
      };
    }
    if (percentage >= 100) {
      return {
        label: 'Completo',
        icon: CheckCircle2,
        className: 'bg-green-50 text-green-700 border-green-200',
        color: 'text-green-600',
      };
    }
    return {
      label: 'Parcial',
      icon: AlertCircle,
      className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      color: 'text-yellow-600',
    };
  };

  const status = getStatus();
  const Icon = status.icon;
  const displayPercentage = Math.min(Math.round(percentage), 999); // Cap display at 999%

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`${status.className} cursor-pointer gap-1`}>
              <Icon className="h-3 w-3" />
              {displayPercentage}%
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-medium">{status.label}</p>
              <p>Asignado: {formatCurrency(allocatedAmount)}</p>
              <p>Total factura: {formatCurrency(totalAmount)}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={`${status.className} gap-1`}>
        <Icon className="h-3 w-3" />
        {displayPercentage}%
      </Badge>
      <span className="text-xs text-muted-foreground">
        {formatCurrency(allocatedAmount)} / {formatCurrency(totalAmount)}
      </span>
    </div>
  );
}

// Badge for budget allocation status (from budget perspective)
interface BudgetAllocationStatusProps {
  invoicedAmount: number;
  budgetTotal: number;
  compact?: boolean;
}

export function BudgetAllocationStatus({ 
  invoicedAmount, 
  budgetTotal,
  compact = false 
}: BudgetAllocationStatusProps) {
  const percentage = budgetTotal > 0 ? (invoicedAmount / budgetTotal) * 100 : 0;
  const remaining = budgetTotal - invoicedAmount;

  const getStatus = () => {
    if (percentage === 0) {
      return {
        label: 'Pendiente facturar',
        icon: Circle,
        className: 'bg-muted text-muted-foreground border-muted',
      };
    }
    if (percentage > 100) {
      return {
        label: 'Sobre-facturado',
        icon: AlertTriangle,
        className: 'bg-red-50 text-red-700 border-red-200',
      };
    }
    if (percentage >= 100) {
      return {
        label: 'Facturado',
        icon: CheckCircle2,
        className: 'bg-green-50 text-green-700 border-green-200',
      };
    }
    return {
      label: 'Facturado parcial',
      icon: AlertCircle,
      className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    };
  };

  const status = getStatus();
  const Icon = status.icon;
  const displayPercentage = Math.min(Math.round(percentage), 999);

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`${status.className} cursor-pointer gap-1`}>
              <Icon className="h-3 w-3" />
              {displayPercentage}%
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-medium">{status.label}</p>
              <p>Facturado: {formatCurrency(invoicedAmount)}</p>
              <p>Total presupuesto: {formatCurrency(budgetTotal)}</p>
              {remaining > 0 && <p>Pendiente: {formatCurrency(remaining)}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={`${status.className} gap-1`}>
          <Icon className="h-3 w-3" />
          {status.label}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground">
        {formatCurrency(invoicedAmount)} / {formatCurrency(budgetTotal)} ({displayPercentage}%)
        {remaining > 0 && <span className="ml-1">• Pendiente: {formatCurrency(remaining)}</span>}
      </div>
    </div>
  );
}
