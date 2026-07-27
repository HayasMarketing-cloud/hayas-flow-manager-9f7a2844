import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EntityPnL {
  // Revenue
  estimatedRevenue: number;
  invoicedRevenue: number;
  pendingToInvoice: number;
  
  // Costs (specialists)
  estimatedCosts: number;
  liquidatedCosts: number;
  pendingToLiquidate: number;
  
  // Commissions
  commissionCosts: number;
  commissionAM: number;
  commissionPM: number;
  commissionSales: number;
  
  // Total costs (specialists + commissions)
  totalCosts: number;
  
  // Margin (without commissions)
  realMargin: number;
  realMarginPercent: number;
  estimatedMargin: number;
  estimatedMarginPercent: number;
  
  // Adjusted margin (with commissions)
  adjustedMargin: number;
  adjustedMarginPercent: number;
  
  // Counters
  totalRequests: number;
  invoicedRequests: number;
  liquidatedRequests: number;
  commissionsCount: number;
}

interface CommissionData {
  commission_type: string;
  commission_amount: number;
}

const calculateCommissions = (commissions: CommissionData[]) => {
  const commissionAM = commissions
    .filter(c => c.commission_type === 'am')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);
  
  const commissionPM = commissions
    .filter(c => c.commission_type === 'pm')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);
  
  const commissionSales = commissions
    .filter(c => c.commission_type === 'sales')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

  return {
    commissionAM,
    commissionPM,
    commissionSales,
    commissionCosts: commissionAM + commissionPM + commissionSales,
    commissionsCount: commissions.length,
  };
};

interface PnLOverrides {
  estimatedRevenue?: number;
  invoicedRevenue?: number;
  invoicedRequestsCount?: number;
}

const calculatePnL = (
  data: any[],
  commissions: CommissionData[] = [],
  overrides: PnLOverrides = {}
): EntityPnL => {
  const requestsRevenue = data.reduce((sum, r) => sum + (r.sale_amount || 0), 0);
  const requestsInvoicedRevenue = data.reduce(
    (sum, r) => sum + (r.billed_invoice_id ? (r.sale_amount || 0) : 0),
    0
  );
  const estimatedRevenue = overrides.estimatedRevenue ?? requestsRevenue;
  const invoicedRevenue = overrides.invoicedRevenue ?? requestsInvoicedRevenue;

  const estimatedCosts = data.reduce((sum, r) => sum + (r.cost_to_agency || 0), 0);
  const liquidatedCosts = data.reduce(
    (sum, r) => sum + (r.liquidation_id ? (r.cost_to_agency || 0) : 0),
    0
  );

  const commissionData = calculateCommissions(commissions);
  const totalCosts = liquidatedCosts + commissionData.commissionCosts;

  const realMargin = invoicedRevenue - liquidatedCosts;
  const estimatedMargin = estimatedRevenue - estimatedCosts;
  const adjustedMargin = invoicedRevenue - totalCosts;

  const pendingToInvoice = Math.max(0, estimatedRevenue - invoicedRevenue);

  return {
    estimatedRevenue,
    invoicedRevenue,
    pendingToInvoice,
    estimatedCosts,
    liquidatedCosts,
    pendingToLiquidate: Math.max(0, estimatedCosts - liquidatedCosts),
    ...commissionData,
    totalCosts,
    realMargin,
    realMarginPercent: invoicedRevenue > 0 ? (realMargin / invoicedRevenue) * 100 : 0,
    estimatedMargin,
    estimatedMarginPercent: estimatedRevenue > 0 ? (estimatedMargin / estimatedRevenue) * 100 : 0,
    adjustedMargin,
    adjustedMarginPercent: invoicedRevenue > 0 ? (adjustedMargin / invoicedRevenue) * 100 : 0,
    totalRequests: data.length,
    invoicedRequests:
      overrides.invoicedRequestsCount ?? data.filter((r) => r.billed_invoice_id).length,
    liquidatedRequests: data.filter((r) => r.liquidation_id).length,
  };
};
...
export const useBudgetPnL = (budgetId: string) => {
  return useQuery({
    queryKey: ['budget-pnl', budgetId],
    queryFn: async () => {
      if (!budgetId) return null;

      // Budget total (source of truth for estimated revenue)
      const { data: budget, error: budgetError } = await supabase
        .from('budgets')
        .select('id, total_amount')
        .eq('id', budgetId)
        .single();
      if (budgetError) throw budgetError;

      // Financial requests linked to this budget
      const { data: financialRequests, error } = await supabase
        .from('financial_requests')
        .select('id, sale_amount, cost_to_agency, billed_invoice_id, liquidation_id')
        .eq('budget_id', budgetId);
      if (error) throw error;

      // Invoiced revenue = allocations against this budget
      const { data: allocations, error: allocError } = await supabase
        .from('invoice_budget_allocations')
        .select('invoice_id, allocated_amount')
        .eq('budget_id', budgetId);
      if (allocError) throw allocError;

      const invoicedRevenue = (allocations || []).reduce(
        (sum, a) => sum + Number(a.allocated_amount || 0),
        0
      );
      const invoicedInvoiceIds = Array.from(
        new Set((allocations || []).map((a) => a.invoice_id).filter(Boolean))
      );

      // Commissions: direct budget_id OR overlapping any invoice allocated to this budget
      const commissionsMap = new Map<string, CommissionData & { id: string }>();

      const { data: directComms, error: dcErr } = await supabase
        .from('sales_commissions')
        .select('id, commission_type, commission_amount')
        .eq('budget_id', budgetId);
      if (dcErr) throw dcErr;
      (directComms || []).forEach((c) => commissionsMap.set(c.id, c as any));

      if (invoicedInvoiceIds.length > 0) {
        const { data: invComms, error: icErr } = await supabase
          .from('sales_commissions')
          .select('id, commission_type, commission_amount, invoice_ids')
          .overlaps('invoice_ids', invoicedInvoiceIds);
        if (icErr) throw icErr;
        (invComms || []).forEach((c) => commissionsMap.set(c.id, c as any));
      }

      const commissions = Array.from(commissionsMap.values()).map(
        ({ commission_type, commission_amount }) => ({ commission_type, commission_amount })
      );

      const estimatedRevenue = Number(budget?.total_amount || 0) ||
        (financialRequests || []).reduce((s, r) => s + (r.sale_amount || 0), 0);

      return calculatePnL(financialRequests || [], commissions, {
        estimatedRevenue,
        invoicedRevenue,
        invoicedRequestsCount: (allocations || []).length,
      });
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
