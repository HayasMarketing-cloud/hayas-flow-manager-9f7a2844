import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';

export interface DashboardAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  action?: {
    label: string;
    path: string;
  };
  count: number;
}

export const useDashboardAlerts = () => {
  const { canAccessFinance } = useUserRole();

  return useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: async () => {
      const alerts: DashboardAlert[] = [];

      if (canAccessFinance()) {
        // Overdue invoices (CRITICAL)
        const today = new Date().toISOString().split('T')[0];
        const { data: overdueInvoices } = await supabase
          .from('invoices')
          .select('id')
          .neq('status', 'paid')
          .lt('due_date', today)
          .not('due_date', 'is', null);

        if (overdueInvoices && overdueInvoices.length > 0) {
          alerts.push({
            id: 'overdue-invoices',
            type: 'critical',
            title: `${overdueInvoices.length} factura${overdueInvoices.length > 1 ? 's' : ''} vencida${overdueInvoices.length > 1 ? 's' : ''}`,
            description: 'Requieren atención inmediata',
            action: {
              label: 'Ver facturas',
              path: '/facturas?filter=overdue',
            },
            count: overdueInvoices.length,
          });
        }

        // Draft liquidations (WARNING)
        const { data: draftLiquidations } = await supabase
          .from('liquidations')
          .select('id')
          .eq('status', 'draft');

        if (draftLiquidations && draftLiquidations.length > 0) {
          alerts.push({
            id: 'draft-liquidations',
            type: 'warning',
            title: `${draftLiquidations.length} liquidación${draftLiquidations.length > 1 ? 'es' : ''} en borrador`,
            description: 'Pendientes de envío',
            action: {
              label: 'Ver liquidaciones',
              path: '/liquidaciones?status=draft',
            },
            count: draftLiquidations.length,
          });
        }

        // Unbilled completed requests (INFO)
        const { data: unbilledRequests } = await supabase
          .from('financial_requests')
          .select('id')
          .eq('status', 'completed')
          .is('billed_invoice_id', null);

        if (unbilledRequests && unbilledRequests.length > 0) {
          alerts.push({
            id: 'unbilled-requests',
            type: 'info',
            title: `${unbilledRequests.length} solicitud${unbilledRequests.length > 1 ? 'es' : ''} sin facturar`,
            description: 'Activas pero no facturadas',
            action: {
              label: 'Ver solicitudes',
              path: '/solicitudes',
            },
            count: unbilledRequests.length,
          });
        }
      }

      return alerts.sort((a, b) => {
        const priority = { critical: 3, warning: 2, info: 1 };
        return priority[b.type] - priority[a.type];
      });
    },
  });
};
