import { DashboardKPIs } from '@/hooks/useDashboardKPIs';
import { DashboardAlert } from '@/hooks/useDashboardAlerts';

export const getMockDashboardKPIs = (): DashboardKPIs => {
  return {
    revenue: {
      current: 45280,
      previous: 40350,
      trend: 'up',
      percentage: 12.2,
    },
    costs: {
      current: 32150,
      previous: 29800,
      trend: 'up',
      percentage: 7.9,
    },
    margin: {
      current: 29.1,
      previous: 26.2,
      trend: 'up',
      percentage: 2.9,
    },
    activeRequests: {
      current: 12,
      previous: 15,
      trend: 'down',
      percentage: -20.0,
    },
    pendingInvoices: {
      count: 5,
      amount: 12500,
    },
    overdueInvoices: {
      count: 2,
      amount: 4800,
    },
    pendingLiquidations: {
      count: 3,
      amount: 8200,
    },
  };
};

export const getMockDashboardAlerts = (): DashboardAlert[] => {
  return [
    {
      id: 'overdue-invoices',
      type: 'critical',
      title: '2 facturas vencidas',
      description: 'Requieren atención inmediata',
      action: {
        label: 'Ver facturas',
        path: '/facturas?filter=overdue',
      },
      count: 2,
    },
    {
      id: 'draft-liquidations',
      type: 'warning',
      title: '3 liquidaciones en borrador',
      description: 'Pendientes de envío',
      action: {
        label: 'Ver liquidaciones',
        path: '/liquidaciones?status=draft',
      },
      count: 3,
    },
    {
      id: 'unbilled-requests',
      type: 'info',
      title: '5 solicitudes sin facturar',
      description: 'Completadas pero no facturadas',
      action: {
        label: 'Ver solicitudes',
        path: '/flujo-requests',
      },
      count: 5,
    },
  ];
};

export const getMockRevenueChartData = () => {
  return [
    { month: 'Ene', revenue: 38500, costs: 27200 },
    { month: 'Feb', revenue: 42100, costs: 30100 },
    { month: 'Mar', revenue: 45280, costs: 32150 },
    { month: 'Abr', revenue: 39800, costs: 28900 },
    { month: 'May', revenue: 47200, costs: 33400 },
    { month: 'Jun', revenue: 51000, costs: 35800 },
    { month: 'Jul', revenue: 48500, costs: 34200 },
    { month: 'Ago', revenue: 43800, costs: 31500 },
    { month: 'Sep', revenue: 52100, costs: 36800 },
    { month: 'Oct', revenue: 49200, costs: 35100 },
    { month: 'Nov', revenue: 54500, costs: 38200 },
    { month: 'Dic', revenue: 58000, costs: 40500 },
  ];
};
