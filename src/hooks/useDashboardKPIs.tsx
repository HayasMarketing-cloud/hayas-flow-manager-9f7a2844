import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from './useUserRole';
import { DashboardFilters } from './useDashboardFilters';

interface KPIValue {
  current: number;
  previous: number;
  trend: 'up' | 'down' | 'neutral';
  percentage: number;
}

export interface DashboardKPIs {
  revenue: KPIValue;
  costs: KPIValue;
  margin: KPIValue;
  activeRequests: KPIValue;
  pendingInvoices: { count: number; amount: number };
  overdueInvoices: { count: number; amount: number };
  pendingLiquidations: { count: number; amount: number };
}

const calculateTrend = (current: number, previous: number): 'up' | 'down' | 'neutral' => {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'neutral';
};

const calculatePercentage = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

export const useDashboardKPIs = (filters: DashboardFilters, previousPeriod: { year: number; month: number | null }) => {
  const { user } = useAuth();
  const { canAccessFinance, isSpecialist } = useUserRole();

  return useQuery({
    queryKey: ['dashboard-kpis', filters, user?.id],
    queryFn: async () => {
      const kpis: DashboardKPIs = {
        revenue: { current: 0, previous: 0, trend: 'neutral', percentage: 0 },
        costs: { current: 0, previous: 0, trend: 'neutral', percentage: 0 },
        margin: { current: 0, previous: 0, trend: 'neutral', percentage: 0 },
        activeRequests: { current: 0, previous: 0, trend: 'neutral', percentage: 0 },
        pendingInvoices: { count: 0, amount: 0 },
        overdueInvoices: { count: 0, amount: 0 },
        pendingLiquidations: { count: 0, amount: 0 },
      };

      const getDateRange = (year: number, month: number | null) => {
        if (month) {
          const start = `${year}-${String(month).padStart(2, '0')}-01`;
          const end = new Date(year, month, 0).toISOString().split('T')[0];
          return { start, end };
        }
        return { start: `${year}-01-01`, end: `${year}-12-31` };
      };

      const currentRange = getDateRange(filters.year, filters.month);
      const previousRange = getDateRange(previousPeriod.year, previousPeriod.month);

      if (canAccessFinance()) {
        // Revenue (invoices paid)
        const [currentRevenue, previousRevenue] = await Promise.all([
          supabase
            .from('invoices')
            .select('total_amount')
            .eq('status', 'paid')
            .gte('invoice_date', currentRange.start)
            .lte('invoice_date', currentRange.end),
          supabase
            .from('invoices')
            .select('total_amount')
            .eq('status', 'paid')
            .gte('invoice_date', previousRange.start)
            .lte('invoice_date', previousRange.end),
        ]);

        const currentRevenueTotal = currentRevenue.data?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0;
        const previousRevenueTotal = previousRevenue.data?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0;

        kpis.revenue = {
          current: currentRevenueTotal,
          previous: previousRevenueTotal,
          trend: calculateTrend(currentRevenueTotal, previousRevenueTotal),
          percentage: calculatePercentage(currentRevenueTotal, previousRevenueTotal),
        };

        // Costs (liquidations paid)
        let currentCostsQuery = supabase
          .from('liquidations')
          .select('total_amount')
          .eq('status', 'paid')
          .eq('period_year', filters.year);

        let previousCostsQuery = supabase
          .from('liquidations')
          .select('total_amount')
          .eq('status', 'paid')
          .eq('period_year', previousPeriod.year);

        if (filters.month) {
          currentCostsQuery = currentCostsQuery.eq('period_month', filters.month);
        }

        if (previousPeriod.month) {
          previousCostsQuery = previousCostsQuery.eq('period_month', previousPeriod.month);
        }

        const [currentCosts, previousCosts] = await Promise.all([
          currentCostsQuery,
          previousCostsQuery,
        ]);

        const currentCostsTotal = currentCosts.data?.reduce((sum, liq) => sum + liq.total_amount, 0) || 0;
        const previousCostsTotal = previousCosts.data?.reduce((sum, liq) => sum + liq.total_amount, 0) || 0;

        kpis.costs = {
          current: currentCostsTotal,
          previous: previousCostsTotal,
          trend: calculateTrend(currentCostsTotal, previousCostsTotal),
          percentage: calculatePercentage(currentCostsTotal, previousCostsTotal),
        };

        // Margin
        const currentMargin = currentRevenueTotal > 0 
          ? ((currentRevenueTotal - currentCostsTotal) / currentRevenueTotal) * 100 
          : 0;
        const previousMargin = previousRevenueTotal > 0 
          ? ((previousRevenueTotal - previousCostsTotal) / previousRevenueTotal) * 100 
          : 0;

        kpis.margin = {
          current: currentMargin,
          previous: previousMargin,
          trend: calculateTrend(currentMargin, previousMargin),
          percentage: currentMargin - previousMargin,
        };

        // Pending invoices
        const pendingInvoices = await supabase
          .from('invoices')
          .select('total_amount')
          .in('status', ['draft', 'sent']);

        kpis.pendingInvoices = {
          count: pendingInvoices.data?.length || 0,
          amount: pendingInvoices.data?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0,
        };

        // Overdue invoices
        const today = new Date().toISOString().split('T')[0];
        const overdueInvoices = await supabase
          .from('invoices')
          .select('total_amount')
          .neq('status', 'paid')
          .lt('due_date', today)
          .not('due_date', 'is', null);

        kpis.overdueInvoices = {
          count: overdueInvoices.data?.length || 0,
          amount: overdueInvoices.data?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0,
        };

        // Pending liquidations
        const pendingLiquidations = await supabase
          .from('liquidations')
          .select('total_amount')
          .in('status', ['draft', 'sent']);

        kpis.pendingLiquidations = {
          count: pendingLiquidations.data?.length || 0,
          amount: pendingLiquidations.data?.reduce((sum, liq) => sum + liq.total_amount, 0) || 0,
        };
      }

      // Active requests
      const [currentRequests, previousRequests] = await Promise.all([
        supabase
          .from('financial_requests')
          .select('id')
          .in('status', ['pending_specialist', 'in_progress', 'pending_review'])
          .gte('created_at', currentRange.start)
          .lte('created_at', currentRange.end),
        supabase
          .from('financial_requests')
          .select('id')
          .in('status', ['pending_specialist', 'in_progress', 'pending_review'])
          .gte('created_at', previousRange.start)
          .lte('created_at', previousRange.end),
      ]);

      kpis.activeRequests = {
        current: currentRequests.data?.length || 0,
        previous: previousRequests.data?.length || 0,
        trend: calculateTrend(currentRequests.data?.length || 0, previousRequests.data?.length || 0),
        percentage: calculatePercentage(currentRequests.data?.length || 0, previousRequests.data?.length || 0),
      };

      return kpis;
    },
    enabled: !!user,
  });
};
