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

export interface DashboardMensualData {
  kpis: MonthlyKPIs;
  clients: ClientSummary[];
  specialists: SpecialistSummary[];
}

export const useDashboardMensualData = (year: number, month: number, viewMode: ViewMode) => {
  return useQuery({
    queryKey: ['dashboard-mensual-data', year, month, viewMode],
    queryFn: async (): Promise<DashboardMensualData> => {
      // Fetch all needed data in parallel
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      // Always filter by period month/year to show all entities for the selected month
      // ViewMode only affects KPI calculations (which amounts to consider)
      const [
        invoicesRes,
        liquidationsRes,
        clientsRes,
        contractsRes,
        budgetsRes,
        commissionsRes,
        allocationsRes,
      ] = await Promise.all([
        // Invoices: filter by billing_period or invoice_date month
        supabase
          .from('invoices')
          .select('id, code, client_id, contract_id, budget_id, invoice_date, paid_at, status, subtotal, total_amount, billing_period_month, billing_period_year')
          .gte('invoice_date', startDate)
          .lte('invoice_date', endDate),
        // Liquidations: always filter by period
        supabase
          .from('liquidations')
          .select('id, code, specialist_id, period_month, period_year, status, subtotal, total_amount, paid_at, specialist_invoice_url, specialist:specialists(id, name)')
          .eq('period_year', year)
          .eq('period_month', month),
        // Clients
        supabase.from('clients').select('id, name'),
        // Contracts
        supabase.from('contracts').select('id, code, title, client_id'),
        // Budgets
        supabase.from('budgets').select('id, code, title, client_id'),
        // Commissions - get commissions linked to invoices of the period
        supabase.from('sales_commissions').select('id, commission_type, commission_amount, status, contract_id, budget_id, invoice_ids, seller_user_id'),
        // Invoice-budget allocations
        supabase.from('invoice_budget_allocations').select('invoice_id, budget_id, allocated_amount'),
      ]);

      const invoices = (invoicesRes.data || []) as InvoiceRow[];
      const liquidations = (liquidationsRes.data || []) as any[];
      const clients = clientsRes.data || [];
      const contracts = contractsRes.data || [];
      const budgets = budgetsRes.data || [];
      const allCommissions = (commissionsRes.data || []) as CommissionRow[];
      const allocations = allocationsRes.data || [];

      // Build lookup maps
      const clientMap = new Map(clients.map(c => [c.id, c.name]));
      const contractMap = new Map(contracts.map(c => [c.id, { code: c.code, title: c.title, client_id: c.client_id }]));
      const budgetMap = new Map(budgets.map(b => [b.id, { code: b.code, title: b.title, client_id: b.client_id }]));

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

      // Group liquidations by specialist, also compute costs per client via requests
      // For now, liquidation costs aren't directly tied to clients in this simple model
      // We'll show them in the specialists section
      
      // Build client summaries
      const clientSummaries: ClientSummary[] = [];
      
      clientInvoices.forEach((invs, clientId) => {
        const clientName = clientMap.get(clientId) || 'Cliente desconocido';
        // For cashflow: only count paid invoices in revenue; for accrual: count all
        const revenueInvs = viewMode === 'cashflow' ? invs.filter(i => i.status === 'paid') : invs;
        const revenue = revenueInvs.reduce((sum, inv) => sum + inv.subtotal, 0);
        
        // Group by origin (contract or budget)
        const originMap = new Map<string, { type: 'contract' | 'budget'; id: string; code: string; title: string; invoices: InvoiceRow[]; revenue: number }>();
        
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
            // Check allocations for budget links
            const alloc = allocations.find(a => a.invoice_id === inv.id);
            if (alloc) {
              originKey = `budget-${alloc.budget_id}`;
              const bg = budgetMap.get(alloc.budget_id);
              originData = { type: 'budget' as const, id: alloc.budget_id, code: bg?.code || '?', title: bg?.title || 'Presupuesto' };
            } else {
              originData = { type: 'budget' as const, id: 'sin-origen', code: '---', title: 'Sin origen asignado' };
            }
          }

          const existing = originMap.get(originKey);
          if (existing) {
            existing.invoices.push(inv);
            existing.revenue += inv.subtotal;
          } else {
            originMap.set(originKey, { ...originData, invoices: [inv], revenue: inv.subtotal });
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
          // Commissions per origin (approximate by distributing proportionally)
          const originCommissions = totalClientCommissions * (o.revenue / (revenue || 1));
          const margin = o.revenue - originCommissions;
          origins.push({
            type: o.type,
            id: o.id,
            code: o.code,
            title: o.title,
            revenue: o.revenue,
            costs: 0, // specialist costs shown in specialist section
            commissions: originCommissions,
            margin,
            invoices: o.invoices,
          });
        });

        const margin = revenue - totalClientCommissions;
        clientSummaries.push({
          clientId,
          clientName,
          revenue,
          costs: 0,
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
          // Always show total of all liquidations for the period in the row summary
          totalCost: data.liquidations.reduce((sum: number, l: any) => sum + l.total_amount, 0),
          liquidations: data.liquidations,
        });
      });
      specialistSummaries.sort((a, b) => b.totalCost - a.totalCost);

      // KPIs
      const totalRevenue = clientSummaries.reduce((sum, c) => sum + c.revenue, 0);
      const totalLiquidationCosts = specialistSummaries.reduce((sum, s) => sum + s.totalCost, 0);
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
      };
    },
  });
};
