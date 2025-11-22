import { useDashboardKPIs } from './useDashboardKPIs';
import { useDashboardAlerts } from './useDashboardAlerts';
import { useDashboardCharts } from './useDashboardCharts';
import { DashboardFilters } from './useDashboardFilters';

export const useDashboardData = (
  filters: DashboardFilters,
  previousPeriod: { year: number; month: number | null }
) => {
  const kpis = useDashboardKPIs(filters, previousPeriod);
  const alerts = useDashboardAlerts();
  const charts = useDashboardCharts(filters.year);

  const isLoading = kpis.isLoading || alerts.isLoading || charts.isLoading;
  const error = kpis.error || alerts.error || charts.error;

  const refetch = () => {
    kpis.refetch();
    alerts.refetch();
    charts.refetch();
  };

  return {
    kpis: kpis.data,
    alerts: alerts.data,
    charts: charts.data,
    isLoading,
    error,
    refetch,
  };
};
