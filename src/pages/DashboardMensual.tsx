import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Wallet, AlertTriangle, FileText, RefreshCw } from 'lucide-react';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useUserRole } from '@/hooks/useUserRole';
import { KPICard } from '@/components/dashboard/kpis/KPICard';
import { KPISkeleton } from '@/components/dashboard/kpis/KPISkeleton';
import { AlertsWidget } from '@/components/dashboard/widgets/AlertsWidget';
import { QuickActionsWidget } from '@/components/dashboard/widgets/QuickActionsWidget';
import { RevenueChart } from '@/components/dashboard/charts/RevenueChart';
import { MarginTrendChart } from '@/components/dashboard/charts/MarginTrendChart';
import { formatCurrency } from '@/lib/request-utils';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardMensual() {
  const { filters, updateFilters, getPreviousPeriod } = useDashboardFilters();
  const previousPeriod = getPreviousPeriod();
  const { kpis, alerts, charts, isLoading, refetch } = useDashboardData(filters, previousPeriod);
  const { canAccessFinance } = useUserRole();
  const navigate = useNavigate();

  const formatTrendValue = (percentage: number) => {
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage.toFixed(1)}% vs anterior`;
  };

  return (
    <AppLayout 
      title="Dashboard" 
      description="Vista general de métricas y actividad"
    >
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-2 items-center">
                <Select
                  value={filters.year.toString()}
                  onValueChange={(value) => updateFilters({ year: parseInt(value) })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.month?.toString() || 'all'}
                  onValueChange={(value) => 
                    updateFilters({ 
                      month: value === 'all' ? null : parseInt(value),
                      period: value === 'all' ? 'year' : 'month'
                    })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo el año</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {new Date(2024, month - 1).toLocaleDateString('es-ES', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPIs Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <KPISkeleton key={i} />
            ))}
          </div>
        ) : canAccessFinance() && kpis ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Ingresos Totales"
              value={formatCurrency(kpis.revenue.current)}
              icon={DollarSign}
              trend={kpis.revenue.trend}
              trendValue={formatTrendValue(kpis.revenue.percentage)}
              variant="default"
            />

            <KPICard
              title="Costes Totales"
              value={formatCurrency(kpis.costs.current)}
              icon={Wallet}
              trend={kpis.costs.trend}
              trendValue={formatTrendValue(kpis.costs.percentage)}
              variant="default"
            />

            <KPICard
              title="Margen"
              value={`${kpis.margin.current.toFixed(1)}%`}
              subtitle={`${formatCurrency(kpis.revenue.current - kpis.costs.current)}`}
              icon={TrendingUp}
              trend={kpis.margin.trend}
              trendValue={`${kpis.margin.percentage >= 0 ? '+' : ''}${kpis.margin.percentage.toFixed(1)}pp`}
              variant={
                kpis.margin.current >= 30 
                  ? 'success' 
                  : kpis.margin.current >= 20 
                  ? 'warning' 
                  : 'danger'
              }
            />

            <KPICard
              title="Facturas Vencidas"
              value={kpis.overdueInvoices.count}
              subtitle={formatCurrency(kpis.overdueInvoices.amount)}
              icon={AlertTriangle}
              variant={kpis.overdueInvoices.count > 0 ? 'danger' : 'default'}
              onClick={() => navigate('/facturas?filter=overdue')}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Requests Activos"
              value={kpis?.activeRequests.current || 0}
              icon={FileText}
              trend={kpis?.activeRequests.trend}
              trendValue={kpis ? formatTrendValue(kpis.activeRequests.percentage) : undefined}
            />
          </div>
        )}

        {/* Charts and Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {isLoading ? (
              <>
                <Card>
                  <CardContent className="pt-6">
                    <Skeleton className="h-[300px] w-full" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <Skeleton className="h-[300px] w-full" />
                  </CardContent>
                </Card>
              </>
            ) : charts ? (
              <>
                <RevenueChart data={charts.revenueByMonth} />
                <MarginTrendChart data={charts.marginByMonth} />
              </>
            ) : null}
          </div>
          <div className="space-y-6">
            <AlertsWidget alerts={alerts} isLoading={isLoading} />
            <QuickActionsWidget alerts={alerts} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
