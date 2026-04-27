import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ViewMode = 'cashflow' | 'accrual';

interface InvoiceRow {
  id: string;
  code: string;
  client_id: string;
  contract_id: string | null;
  budget_id: string | null;
  invoice_date: string;
  paid_at: string | null;
  status: string;
  subtotal: number;
  total_amount: number;
  billing_period_month: number | null;
  billing_period_year: number | null;
}

interface LiquidationRow {
  id: string;
  code: string;
  specialist_id: string;
  period_month: number;
  period_year: number;
  status: string;
  subtotal: number;
  total_amount: number;
  paid_at: string | null;
  specialist_invoice_url: string | null;
  specialist: { id: string; name: string } | null;
}

interface CommissionRow {
  id: string;
  commission_type: string;
  commission_amount: number;
  status: string;
  contract_id: string | null;
  budget_id: string | null;
  invoice_ids: string[] | null;
  seller_user_id: string;
}

export interface ClientSummary {
  clientId: string;
  clientName: string;
  revenue: number;
  costs: number;
  commissions: number;
  margin: number;
  marginPercent: number;
  invoices: InvoiceRow[];
  origins: OriginSummary[];
}

export interface OriginSummary {
  type: 'contract' | 'budget';
  id: string;
  code: string;
  title: string;
  revenue: number;
  costs: number;
  commissions: number;
  margin: number;
  invoices: InvoiceRow[];
}

export interface SpecialistSummary {
  specialistId: string;
  specialistName: string;
  totalCost: number;
  liquidations: LiquidationRow[];
}

export interface MonthlyKPIs {
  totalRevenue: number;
  totalCosts: number;
  totalCommissions: number;
  grossMargin: number;
  grossMarginPercent: number;
  netCashFlow: number;
}

export interface ReconciliationData {
  requestsWithoutInvoice: number;
  requestsWithoutLiquidation: number;
  requestsWithoutOrigin: number;
  invoicesWithoutPeriod: number;
}

export interface DashboardMensualData {
  kpis: MonthlyKPIs;
  clients: ClientSummary[];
  specialists: SpecialistSummary[];
  reconciliation: ReconciliationData;
}

export const useDashboardMensualData = (year: number, month: number, viewMode: ViewMode) => {
  return useQuery({
    queryKey: ['dashboard-mensual-data', year, month, viewMode],
    queryFn: async (): Promise<DashboardMensualData> => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      // Range to detect invoices without billing_period emitted in the selected month or in N+1 (typical case)
      const nextMonthStart = new Date(year, month, 1).toISOString().split('T')[0];
      const nextMonthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const [
        invoicesRes,
        liquidationsRes,
        clientsRes,
        contractsRes,
        budgetsRes,
        commissionsRes,
        allocationsRes,
        requestsRes,
        reconciliationRes,
        invoicesWithoutPeriodRes,
      ] = await Promise.all([
        // Invoices: ALWAYS filter by billing_period (the work month).
        // The cashflow vs accrual difference is applied later when computing revenue.
        supabase
          .from('invoices')
          .select('id, code, client_id, contract_id, budget_id, invoice_date, paid_at, status, subtotal, total_amount, billing_period_month, billing_period_year')
          .eq('billing_period_year', year)
          .eq('billing_period_month', month),
        supabase
          .from('liquidations')
          .select('id, code, specialist_id, period_month, period_year, status, subtotal, total_amount, paid_at, specialist_invoice_url, specialist:specialists(id, name)')
          .eq('period_year', year)
          .eq('period_month', month),
        supabase.from('clients').select('id, name'),
        supabase.from('contracts').select('id, code, title, client_id'),
        supabase.from('budgets').select('id, code, title, client_id'),
        supabase.from('sales_commissions').select('id, commission_type, commission_amount, status, contract_id, budget_id, invoice_ids, seller_user_id'),
        supabase.from('invoice_budget_allocations').select('invoice_id, budget_id, allocated_amount'),
        // Financial requests for the work period — to cross-reference costs with clients
        supabase
          .from('financial_requests')
          .select('id, client_id, specialist_id, cost_to_agency, billed_invoice_id, liquidation_id, budget_id, contract_id, status')
          .eq('work_year', year)
          .eq('work_month', month),
        // Reconciliation: requests of this month
        supabase
          .from('financial_requests')
          .select('id, billed_invoice_id, liquidation_id, budget_id, contract_id, status')
          .eq('work_year', year)
          .eq('work_month', month)
          .eq('status', 'completed'),
      ]);

      const invoices = (invoicesRes.data || []) as InvoiceRow[];
      const liquidations = (liquidationsRes.data || []) as any[];
      const clients = clientsRes.data || [];
      const contracts = contractsRes.data || [];
      const budgets = budgetsRes.data || [];
      const allCommissions = (commissionsRes.data || []) as CommissionRow[];
      const allocations = allocationsRes.data || [];
      const requests = requestsRes.data || [];
      const reconciliationRequests = reconciliationRes.data || [];

      // Build lookup maps
      const clientMap = new Map(clients.map(c => [c.id, c.name]));
      const contractMap = new Map(contracts.map(c => [c.id, { code: c.code, title: c.title, client_id: c.client_id }]));
      const budgetMap = new Map(budgets.map(b => [b.id, { code: b.code, title: b.title, client_id: b.client_id }]));

      // Build costs per client from financial_requests
      const costsByClient = new Map<string, number>();
      requests.forEach((r: any) => {
        if (r.cost_to_agency && r.client_id) {
          costsByClient.set(r.client_id, (costsByClient.get(r.client_id) || 0) + Number(r.cost_to_agency));
        }
      });

      // Filter commissions relevant to these invoices
      const invoiceIds = new Set(invoices.map(i => i.id));
      const relevantCommissions = allCommissions.filter(c => 
        c.invoice_ids?.some(id => invoiceIds.has(id))
      );

      // Group invoices by client
      const clientInvoices = new Map<string, InvoiceRow[]>();
      invoices.forEach(inv => {
        const arr = clientInvoices.get(inv.client_id) || [];
        arr.push(inv);
        clientInvoices.set(inv.client_id, arr);
      });

      // Also ensure clients with costs but no invoices appear
      costsByClient.forEach((_, clientId) => {
        if (!clientInvoices.has(clientId)) {
          clientInvoices.set(clientId, []);
        }
      });

      // Build client summaries
      const clientSummaries: ClientSummary[] = [];
      
      clientInvoices.forEach((invs, clientId) => {
        const clientName = clientMap.get(clientId) || 'Cliente desconocido';
        const revenueInvs = viewMode === 'cashflow' ? invs.filter(i => i.status === 'paid') : invs;
        const revenue = revenueInvs.reduce((sum, inv) => sum + inv.subtotal, 0);
        const clientCosts = costsByClient.get(clientId) || 0;
        
        // Group by origin (contract or budget)
        const originMap = new Map<string, { type: 'contract' | 'budget'; id: string; code: string; title: string; invoices: InvoiceRow[]; revenue: number }>();
        
        const paidInvIds = new Set(invs.filter(i => i.status === 'paid').map(i => i.id));

        invs.forEach(inv => {
          let originKey = 'none';
          let originData: any = null;
          
          if (inv.contract_id) {
            originKey = `contract-${inv.contract_id}`;
            const ct = contractMap.get(inv.contract_id);
            originData = { type: 'contract' as const, id: inv.contract_id, code: ct?.code || '?', title: ct?.title || 'Contrato' };
          } else if (inv.budget_id) {
            originKey = `budget-${inv.budget_id}`;
            const bg = budgetMap.get(inv.budget_id);
            originData = { type: 'budget' as const, id: inv.budget_id, code: bg?.code || '?', title: bg?.title || 'Presupuesto' };
          } else {
            const alloc = allocations.find(a => a.invoice_id === inv.id);
            if (alloc) {
              originKey = `budget-${alloc.budget_id}`;
              const bg = budgetMap.get(alloc.budget_id);
              originData = { type: 'budget' as const, id: alloc.budget_id, code: bg?.code || '?', title: bg?.title || 'Presupuesto' };
            } else {
              originData = { type: 'budget' as const, id: 'sin-origen', code: '---', title: 'Sin origen asignado' };
            }
          }

          const countsForRevenue = viewMode === 'cashflow' ? paidInvIds.has(inv.id) : true;
          const invRevenue = countsForRevenue ? inv.subtotal : 0;

          const existing = originMap.get(originKey);
          if (existing) {
            existing.invoices.push(inv);
            existing.revenue += invRevenue;
          } else {
            originMap.set(originKey, { ...originData, invoices: [inv], revenue: invRevenue });
          }
        });

        // Calculate commissions for this client
        const clientInvoiceIds = new Set(invs.map(i => i.id));
        const clientCommissions = relevantCommissions.filter(c =>
          c.invoice_ids?.some(id => clientInvoiceIds.has(id))
        );
        const totalClientCommissions = clientCommissions.reduce((sum, c) => sum + c.commission_amount, 0);

        // Build origin summaries
        const origins: OriginSummary[] = [];
        originMap.forEach(o => {
          const originCommissions = totalClientCommissions * (o.revenue / (revenue || 1));
          const originCosts = clientCosts * (o.revenue / (revenue || 1));
          const margin = o.revenue - originCosts - originCommissions;
          origins.push({
            type: o.type,
            id: o.id,
            code: o.code,
            title: o.title,
            revenue: o.revenue,
            costs: originCosts,
            commissions: originCommissions,
            margin,
            invoices: o.invoices,
          });
        });

        const margin = revenue - clientCosts - totalClientCommissions;
        clientSummaries.push({
          clientId,
          clientName,
          revenue,
          costs: clientCosts,
          commissions: totalClientCommissions,
          margin,
          marginPercent: revenue > 0 ? (margin / revenue) * 100 : 0,
          invoices: invs,
          origins,
        });
      });

      // Sort by revenue desc
      clientSummaries.sort((a, b) => b.revenue - a.revenue);

      // Build specialist summaries
      const specMap = new Map<string, { name: string; liquidations: any[] }>();
      liquidations.forEach((liq: any) => {
        const specName = liq.specialist?.name || 'Especialista desconocido';
        const specId = liq.specialist_id;
        const existing = specMap.get(specId);
        if (existing) {
          existing.liquidations.push(liq);
        } else {
          specMap.set(specId, { name: specName, liquidations: [liq] });
        }
      });

      const specialistSummaries: SpecialistSummary[] = [];
      specMap.forEach((data, specId) => {
        specialistSummaries.push({
          specialistId: specId,
          specialistName: data.name,
          totalCost: data.liquidations.reduce((sum: number, l: any) => sum + Number(l.subtotal ?? l.total_amount ?? 0), 0),
          liquidations: data.liquidations,
        });
      });
      specialistSummaries.sort((a, b) => b.totalCost - a.totalCost);

      // Reconciliation
      const reconciliation: ReconciliationData = {
        requestsWithoutInvoice: reconciliationRequests.filter((r: any) => !r.billed_invoice_id).length,
        requestsWithoutLiquidation: reconciliationRequests.filter((r: any) => !r.liquidation_id).length,
        requestsWithoutOrigin: reconciliationRequests.filter((r: any) => !r.budget_id && !r.contract_id).length,
      };

      // KPIs
      const totalRevenue = clientSummaries.reduce((sum, c) => sum + c.revenue, 0);
      const totalLiquidationCosts = viewMode === 'cashflow'
        ? liquidations
            .filter((l: any) => l.status === 'paid')
            .reduce((sum: number, l: any) => sum + Number(l.subtotal ?? l.total_amount ?? 0), 0)
        : liquidations.reduce((sum: number, l: any) => sum + Number(l.subtotal ?? l.total_amount ?? 0), 0);
      const totalCommissions = relevantCommissions.reduce((sum, c) => sum + c.commission_amount, 0);
      const totalCosts = totalLiquidationCosts + totalCommissions;
      const grossMargin = totalRevenue - totalCosts;

      return {
        kpis: {
          totalRevenue,
          totalCosts,
          totalCommissions,
          grossMargin,
          grossMarginPercent: totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0,
          netCashFlow: totalRevenue - totalLiquidationCosts,
        },
        clients: clientSummaries,
        specialists: specialistSummaries,
        reconciliation,
      };
    },
  });
};
