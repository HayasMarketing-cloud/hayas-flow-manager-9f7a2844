import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EntityPnL {
  // Revenue
  estimatedRevenue: number;
  invoicedRevenue: number;
  pendingToInvoice: number;
  
  // Costs
  estimatedCosts: number;
  liquidatedCosts: number;
  pendingToLiquidate: number;
  
  // Margin
  realMargin: number;
  realMarginPercent: number;
  estimatedMargin: number;
  estimatedMarginPercent: number;
  
  // Counters
  totalRequests: number;
  invoicedRequests: number;
  liquidatedRequests: number;
}

const calculatePnL = (data: any[]): EntityPnL => {
  const estimatedRevenue = data.reduce((sum, r) => sum + (r.sale_amount || 0), 0);
  const invoicedRevenue = data.reduce((sum, r) => 
    sum + (r.billed_invoice_id ? (r.sale_amount || 0) : 0), 0);
  const estimatedCosts = data.reduce((sum, r) => sum + (r.cost_to_agency || 0), 0);
  const liquidatedCosts = data.reduce((sum, r) => 
    sum + (r.liquidation_id ? (r.cost_to_agency || 0) : 0), 0);

  const realMargin = invoicedRevenue - liquidatedCosts;
  const estimatedMargin = estimatedRevenue - estimatedCosts;

  return {
    estimatedRevenue,
    invoicedRevenue,
    pendingToInvoice: estimatedRevenue - invoicedRevenue,
    estimatedCosts,
    liquidatedCosts,
    pendingToLiquidate: estimatedCosts - liquidatedCosts,
    realMargin,
    realMarginPercent: invoicedRevenue > 0 ? (realMargin / invoicedRevenue) * 100 : 0,
    estimatedMargin,
    estimatedMarginPercent: estimatedRevenue > 0 ? (estimatedMargin / estimatedRevenue) * 100 : 0,
    totalRequests: data.length,
    invoicedRequests: data.filter(r => r.billed_invoice_id).length,
    liquidatedRequests: data.filter(r => r.liquidation_id).length,
  };
};

export const useProjectPnL = (projectId: string) => {
  return useQuery({
    queryKey: ['project-pnl', projectId],
    queryFn: async () => {
      if (!projectId) return null;

      // Get financial_requests via operational_requests for this project
      const { data: operationalRequests, error: orError } = await supabase
        .from('operational_requests')
        .select('financial_request_id')
        .eq('operational_project_id', projectId)
        .not('financial_request_id', 'is', null);

      if (orError) throw orError;
      if (!operationalRequests?.length) {
        return calculatePnL([]);
      }

      const financialRequestIds = operationalRequests
        .map(or => or.financial_request_id)
        .filter(Boolean) as string[];

      if (!financialRequestIds.length) {
        return calculatePnL([]);
      }

      const { data: financialRequests, error: frError } = await supabase
        .from('financial_requests')
        .select('id, sale_amount, cost_to_agency, billed_invoice_id, liquidation_id')
        .in('id', financialRequestIds);

      if (frError) throw frError;

      return calculatePnL(financialRequests || []);
    },
    enabled: !!projectId,
  });
};

export const useBudgetPnL = (budgetId: string) => {
  return useQuery({
    queryKey: ['budget-pnl', budgetId],
    queryFn: async () => {
      if (!budgetId) return null;

      const { data: financialRequests, error } = await supabase
        .from('financial_requests')
        .select('id, sale_amount, cost_to_agency, billed_invoice_id, liquidation_id')
        .eq('budget_id', budgetId);

      if (error) throw error;

      return calculatePnL(financialRequests || []);
    },
    enabled: !!budgetId,
  });
};

// Hook for consolidated P&L report across all projects/budgets
export const useConsolidatedPnL = (options?: { year?: number; month?: number }) => {
  return useQuery({
    queryKey: ['consolidated-pnl', options?.year, options?.month],
    queryFn: async () => {
      // Get all operational projects with their requests
      const { data: projects, error: projectsError } = await supabase
        .from('operational_projects')
        .select(`
          id,
          name,
          client:clients(id, name),
          budget:budgets(id, title)
        `)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // Get all financial requests with project link via operational_requests
      const { data: operationalRequests, error: orError } = await supabase
        .from('operational_requests')
        .select(`
          operational_project_id,
          financial_request:financial_requests(
            id,
            sale_amount,
            cost_to_agency,
            billed_invoice_id,
            liquidation_id,
            budget_id
          )
        `)
        .not('financial_request_id', 'is', null);

      if (orError) throw orError;

      // Get budgets without projects but with requests
      const { data: budgetsWithRequests, error: budgetsError } = await supabase
        .from('budgets')
        .select(`
          id,
          title,
          client:clients(id, name)
        `)
        .order('created_at', { ascending: false });

      if (budgetsError) throw budgetsError;

      // Get financial requests by budget
      const { data: allFinancialRequests, error: frError } = await supabase
        .from('financial_requests')
        .select('id, budget_id, sale_amount, cost_to_agency, billed_invoice_id, liquidation_id');

      if (frError) throw frError;

      // Build project P&L map
      const projectPnLMap = new Map<string, { project: any; requests: any[] }>();
      
      projects?.forEach(project => {
        projectPnLMap.set(project.id, { project, requests: [] });
      });

      operationalRequests?.forEach(or => {
        if (or.operational_project_id && or.financial_request) {
          const entry = projectPnLMap.get(or.operational_project_id);
          if (entry) {
            entry.requests.push(or.financial_request);
          }
        }
      });

      // Build budget P&L map (for budgets without projects)
      const budgetPnLMap = new Map<string, { budget: any; requests: any[] }>();
      const projectBudgetIds = new Set(
        projects?.filter(p => p.budget?.id).map(p => p.budget!.id)
      );

      budgetsWithRequests?.forEach(budget => {
        if (!projectBudgetIds.has(budget.id)) {
          budgetPnLMap.set(budget.id, { budget, requests: [] });
        }
      });

      allFinancialRequests?.forEach(fr => {
        if (fr.budget_id && budgetPnLMap.has(fr.budget_id)) {
          budgetPnLMap.get(fr.budget_id)!.requests.push(fr);
        }
      });

      // Calculate P&L for each entity
      const projectResults = Array.from(projectPnLMap.values())
        .filter(entry => entry.requests.length > 0)
        .map(entry => ({
          type: 'project' as const,
          id: entry.project.id,
          name: entry.project.name,
          clientName: entry.project.client?.name || 'Sin cliente',
          budgetTitle: entry.project.budget?.title,
          pnl: calculatePnL(entry.requests),
        }));

      const budgetResults = Array.from(budgetPnLMap.values())
        .filter(entry => entry.requests.length > 0)
        .map(entry => ({
          type: 'budget' as const,
          id: entry.budget.id,
          name: entry.budget.title,
          clientName: entry.budget.client?.name || 'Sin cliente',
          pnl: calculatePnL(entry.requests),
        }));

      const allResults = [...projectResults, ...budgetResults];

      // Calculate totals
      const totals = allResults.reduce(
        (acc, item) => ({
          estimatedRevenue: acc.estimatedRevenue + item.pnl.estimatedRevenue,
          invoicedRevenue: acc.invoicedRevenue + item.pnl.invoicedRevenue,
          estimatedCosts: acc.estimatedCosts + item.pnl.estimatedCosts,
          liquidatedCosts: acc.liquidatedCosts + item.pnl.liquidatedCosts,
          totalRequests: acc.totalRequests + item.pnl.totalRequests,
        }),
        { estimatedRevenue: 0, invoicedRevenue: 0, estimatedCosts: 0, liquidatedCosts: 0, totalRequests: 0 }
      );

      const realMargin = totals.invoicedRevenue - totals.liquidatedCosts;
      const estimatedMargin = totals.estimatedRevenue - totals.estimatedCosts;

      return {
        items: allResults,
        totals: {
          ...totals,
          realMargin,
          realMarginPercent: totals.invoicedRevenue > 0 ? (realMargin / totals.invoicedRevenue) * 100 : 0,
          estimatedMargin,
          estimatedMarginPercent: totals.estimatedRevenue > 0 ? (estimatedMargin / totals.estimatedRevenue) * 100 : 0,
        },
      };
    },
  });
};
