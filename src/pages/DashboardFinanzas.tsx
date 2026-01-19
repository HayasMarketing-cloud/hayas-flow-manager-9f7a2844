import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Wallet, AlertTriangle, FileText, Clock } from 'lucide-react';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useUserRole } from '@/hooks/useUserRole';
import { KPICard } from '@/components/dashboard/kpis/KPICard';
import { KPISkeleton } from '@/components/dashboard/kpis/KPISkeleton';
import { AlertsWidget } from '@/components/dashboard/widgets/AlertsWidget';
import { CompletedProjectsWidget } from '@/components/dashboard/widgets/CompletedProjectsWidget';
import { formatCurrency } from '@/lib/request-utils';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DashboardFinanzas() {
  const { filters, updateFilters, getPreviousPeriod } = useDashboardFilters();
  const previousPeriod = getPreviousPeriod();
  const { kpis, alerts, isLoading } = useDashboardData(filters, previousPeriod);
  const { canAccessFinance } = useUserRole();
  const navigate = useNavigate();

  if (!canAccessFinance()) {
    return (
      <AppLayout title="Dashboard Finanzas">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-destructive">No tienes permisos para acceder a esta sección</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const formatTrendValue = (percentage: number) => {
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage.toFixed(1)}%`;
  };

  return (
    <AppLayout 
      title="Dashboard Finanzas" 
      description="Vista financiera y métricas clave"
    >
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
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
          </CardContent>
        </Card>

        {/* KPIs Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <KPISkeleton key={i} />
            ))}
          </div>
        ) : kpis ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <KPICard
                title="Ingresos (Facturado)"
                value={formatCurrency(kpis.revenue.current)}
                icon={DollarSign}
                trend={kpis.revenue.trend}
                trendValue={formatTrendValue(kpis.revenue.percentage)}
                variant="success"
              />

              <KPICard
                title="Costes (Liquidado)"
                value={formatCurrency(kpis.costs.current)}
                icon={Wallet}
                trend={kpis.costs.trend}
                trendValue={formatTrendValue(kpis.costs.percentage)}
                variant="default"
              />

              <KPICard
                title="Margen Neto"
                value={formatCurrency(kpis.revenue.current - kpis.costs.current)}
                subtitle={`${kpis.margin.current.toFixed(1)}%`}
                icon={TrendingUp}
                trend={kpis.margin.trend}
                trendValue={formatTrendValue(kpis.margin.percentage)}
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
                variant={kpis.overdueInvoices.count > 0 ? 'danger' : 'success'}
                onClick={() => navigate('/facturas?filter=overdue')}
              />

              <KPICard
                title="Facturas Pendientes"
                value={kpis.pendingInvoices.count}
                subtitle={formatCurrency(kpis.pendingInvoices.amount)}
                icon={FileText}
                variant={kpis.pendingInvoices.count > 0 ? 'warning' : 'success'}
                onClick={() => navigate('/facturas?filter=pending')}
              />

              <KPICard
                title="Liquidaciones Pendientes"
                value={kpis.pendingLiquidations.count}
                subtitle={formatCurrency(kpis.pendingLiquidations.amount)}
                icon={Clock}
                variant={kpis.pendingLiquidations.count > 0 ? 'warning' : 'success'}
                onClick={() => navigate('/liquidaciones?filter=pending')}
              />
            </div>

            {/* Widgets Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Completed Projects Widget */}
              <CompletedProjectsWidget />

              {/* Alerts */}
              <AlertsWidget alerts={alerts} isLoading={isLoading} />
            </div>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
