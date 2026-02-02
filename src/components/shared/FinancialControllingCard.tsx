import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Receipt, Wallet, PiggyBank, FileText, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/request-utils';
import { cn } from '@/lib/utils';
import { EntityPnL } from '@/hooks/useEntityPnL';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
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
  const [commissionsOpen, setCommissionsOpen] = useState(false);
  const { canAccessFinance } = useUserRole();

  // Only admin and finanzas can see this component
  if (!canAccessFinance()) {
    return null;
  }
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
  
  const totalCostsPercent = data.estimatedCosts > 0 
    ? (data.totalCosts / (data.estimatedCosts + data.commissionCosts)) * 100 
    : 0;

  const adjustedMarginIsPositive = data.adjustedMargin >= 0;
  const estimatedMarginIsPositive = data.estimatedMargin >= 0;
  const hasCommissions = data.commissionCosts > 0;

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
                <span className="text-muted-foreground">Especialistas:</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(data.liquidatedCosts)}
                </span>
              </div>
              
              {/* Commissions breakdown */}
              {hasCommissions ? (
                <Collapsible open={commissionsOpen} onOpenChange={setCommissionsOpen}>
                  <CollapsibleTrigger className="flex justify-between w-full group">
                    <span className="text-muted-foreground flex items-center gap-1">
                      Comisiones
                      <ChevronDown className={cn(
                        "h-3 w-3 transition-transform",
                        commissionsOpen && "rotate-180"
                      )} />
                    </span>
                    <span className="font-medium text-orange-600">
                      {formatCurrency(data.commissionCosts)}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 pt-1 space-y-1">
                    {data.commissionAM > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">AM:</span>
                        <span>{formatCurrency(data.commissionAM)}</span>
                      </div>
                    )}
                    {data.commissionPM > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">PM:</span>
                        <span>{formatCurrency(data.commissionPM)}</span>
                      </div>
                    )}
                    {data.commissionSales > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Venta:</span>
                        <span>{formatCurrency(data.commissionSales)}</span>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comisiones:</span>
                  <span className="font-medium text-muted-foreground">
                    {formatCurrency(0)}
                  </span>
                </div>
              )}

              <div className="flex justify-between pt-1 border-t">
                <span className="text-muted-foreground font-medium">Total:</span>
                <span className="font-bold text-red-600">
                  {formatCurrency(data.totalCosts)}
                </span>
              </div>
            </div>
            <Progress value={totalCostsPercent} className="h-2" />
          </div>
        </div>

        {/* Margin Section */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            {adjustedMarginIsPositive ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span className="font-semibold text-sm">Margen</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">
                {hasCommissions ? 'Ajustado (con comisiones)' : 'Real (Fact. - Costes)'}
              </p>
              <p className={cn(
                "text-lg font-bold",
                adjustedMarginIsPositive ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(data.adjustedMargin)}
              </p>
              <p className={cn(
                "text-sm",
                adjustedMarginIsPositive ? "text-green-600" : "text-red-600"
              )}>
                {data.adjustedMarginPercent.toFixed(1)}%
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
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t flex-wrap">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            <span>{data.totalRequests} requests</span>
          </div>
          <span>|</span>
          <span>{data.invoicedRequests} facturados</span>
          <span>|</span>
          <span>{data.liquidatedRequests} liquidados</span>
          {hasCommissions && (
            <>
              <span>|</span>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{data.commissionsCount} comisiones</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}