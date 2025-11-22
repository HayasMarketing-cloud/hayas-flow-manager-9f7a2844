import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';

interface ChartData {
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    costs: number;
  }>;
  marginByMonth: Array<{
    month: string;
    margin: number;
  }>;
}

export const useDashboardCharts = (year: number) => {
  const { canAccessFinance } = useUserRole();

  return useQuery({
    queryKey: ['dashboard-charts', year],
    queryFn: async () => {
      const chartData: ChartData = {
        revenueByMonth: [],
        marginByMonth: [],
      };

      if (!canAccessFinance()) {
        return chartData;
      }

      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

      // Get invoices by month
      const { data: invoices } = await supabase
        .from('invoices')
        .select('invoice_date, total_amount, status')
        .eq('status', 'paid')
        .gte('invoice_date', `${year}-01-01`)
        .lte('invoice_date', `${year}-12-31`);

      // Get liquidations by month
      const { data: liquidations } = await supabase
        .from('liquidations')
        .select('period_month, total_amount, status')
        .eq('status', 'paid')
        .eq('period_year', year);

      // Group by month
      const revenueByMonth: Record<number, number> = {};
      const costsByMonth: Record<number, number> = {};

      invoices?.forEach((invoice) => {
        const month = new Date(invoice.invoice_date).getMonth() + 1;
        revenueByMonth[month] = (revenueByMonth[month] || 0) + invoice.total_amount;
      });

      liquidations?.forEach((liquidation) => {
        const month = liquidation.period_month;
        costsByMonth[month] = (costsByMonth[month] || 0) + liquidation.total_amount;
      });

      // Build chart data
      for (let i = 1; i <= 12; i++) {
        const revenue = revenueByMonth[i] || 0;
        const costs = costsByMonth[i] || 0;
        const margin = revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0;

        chartData.revenueByMonth.push({
          month: months[i - 1],
          revenue,
          costs,
        });

        chartData.marginByMonth.push({
          month: months[i - 1],
          margin,
        });
      }

      return chartData;
    },
  });
};
