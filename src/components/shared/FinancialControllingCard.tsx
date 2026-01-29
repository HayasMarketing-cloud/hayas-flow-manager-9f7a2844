import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Receipt, Wallet, PiggyBank, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/request-utils';
import { cn } from '@/lib/utils';
import { EntityPnL } from '@/hooks/useEntityPnL';

interface FinancialControllingCardProps {
  data: EntityPnL | null | undefined;
  isLoading?: boolean;
  title?: string;
  className?: string;
}

export function FinancialControllingCard({
  data,
  isLoading = false,
  title = 'Controlling Financiero',
  className,
}: FinancialControllingCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PiggyBank className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-20" />
          <Skeleton className="h-8" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalRequests === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PiggyBank className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay datos financieros disponibles
          </p>
        </CardContent>
      </Card>
    );
  }

  const invoicedPercent = data.estimatedRevenue > 0 
    ? (data.invoicedRevenue / data.estimatedRevenue) * 100 
    : 0;
  
  const liquidatedPercent = data.estimatedCosts > 0 
    ? (data.liquidatedCosts / data.estimatedCosts) * 100 
    : 0;

  const marginIsPositive = data.realMargin >= 0;
  const estimatedMarginIsPositive = data.estimatedMargin >= 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PiggyBank className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Revenue and Costs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Revenue Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-green-600" />
              <span className="font-semibold text-sm">Ingresos</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimado:</span>
                <span className="font-medium">{formatCurrency(data.estimatedRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Facturado:</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(data.invoicedRevenue)}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({invoicedPercent.toFixed(0)}%)
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pendiente:</span>
                <span className={cn(
                  "font-medium",
                  data.pendingToInvoice > 0 ? "text-amber-600" : "text-muted-foreground"
                )}>
                  {formatCurrency(data.pendingToInvoice)}
                </span>
              </div>
            </div>
            <Progress value={invoicedPercent} className="h-2" />
          </div>

          {/* Costs Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-red-600" />
              <span className="font-semibold text-sm">Costes</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimado:</span>
                <span className="font-medium">{formatCurrency(data.estimatedCosts)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Liquidado:</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(data.liquidatedCosts)}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({liquidatedPercent.toFixed(0)}%)
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pendiente:</span>
                <span className={cn(
                  "font-medium",
                  data.pendingToLiquidate > 0 ? "text-amber-600" : "text-muted-foreground"
                )}>
                  {formatCurrency(data.pendingToLiquidate)}
                </span>
              </div>
            </div>
            <Progress value={liquidatedPercent} className="h-2" />
          </div>
        </div>

        {/* Margin Section */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            {marginIsPositive ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span className="font-semibold text-sm">Margen</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Real (Fact. - Liq.)</p>
              <p className={cn(
                "text-lg font-bold",
                marginIsPositive ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(data.realMargin)}
              </p>
              <p className={cn(
                "text-sm",
                marginIsPositive ? "text-green-600" : "text-red-600"
              )}>
                {data.realMarginPercent.toFixed(1)}%
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Estimado</p>
              <p className={cn(
                "text-lg font-bold",
                estimatedMarginIsPositive ? "text-primary" : "text-red-600"
              )}>
                {formatCurrency(data.estimatedMargin)}
              </p>
              <p className={cn(
                "text-sm",
                estimatedMarginIsPositive ? "text-primary" : "text-red-600"
              )}>
                {data.estimatedMarginPercent.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Counters */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            <span>{data.totalRequests} requests</span>
          </div>
          <span>|</span>
          <span>{data.invoicedRequests} facturados</span>
          <span>|</span>
          <span>{data.liquidatedRequests} liquidados</span>
        </div>
      </CardContent>
    </Card>
  );
}
