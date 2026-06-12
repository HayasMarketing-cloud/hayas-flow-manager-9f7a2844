import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
import { useAssignedClients } from './useAssignedClients';

const now = new Date();
const CURRENT_MONTH = now.getMonth() + 1;
const CURRENT_YEAR = now.getFullYear();

const useScope = () => {
  const { shouldFilterByAssignment, loading: rolesLoading } = useUserRole();
  const { assignedClientIds, isLoading: clientsLoading } = useAssignedClients();
  const needsFilter = !rolesLoading && shouldFilterByAssignment();
  return {
    needsFilter,
    assignedClientIds,
    ready: !rolesLoading && (!needsFilter || !clientsLoading),
  };
};

export interface OverdueRequest {
  id: string;
  code: string;
  title: string;
  status: string;
  work_month: number;
  work_year: number;
  sale_amount: number | null;
  client: { id: string; name: string } | null;
  specialist: { id: string; name: string } | null;
}

export const useOverdueRequests = () => {
  const { needsFilter, assignedClientIds, ready } = useScope();
  return useQuery({
    queryKey: ['dashboard-admin', 'overdue-requests', needsFilter, assignedClientIds],
    enabled: ready && (!needsFilter || assignedClientIds.length > 0),
    queryFn: async (): Promise<OverdueRequest[]> => {
      let q = supabase
        .from('financial_requests')
        .select('id, code, title, status, work_month, work_year, sale_amount, liquidation_id, billed_invoice_id, is_recurring_template, client:clients(id, name), specialist:specialists(id, name)')
        .not('status', 'in', '("completed","cancelled")')
        .eq('is_recurring_template', false)
        .is('liquidation_id', null)
        .not('work_year', 'is', null)
        .not('work_month', 'is', null);

      if (needsFilter) q = q.in('client_id', assignedClientIds);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).filter(r =>
        r.work_year! < CURRENT_YEAR ||
        (r.work_year === CURRENT_YEAR && r.work_month! < CURRENT_MONTH)
      ).sort((a, b) => (a.work_year! - b.work_year!) || (a.work_month! - b.work_month!)) as any;
    },
  });
};

export interface ApprovedBudgetWithoutRequests {
  id: string;
  code: string;
  title: string;
  total_amount: number | null;
  created_at: string;
  client: { id: string; name: string } | null;
}

export const useApprovedBudgetsWithoutRequests = () => {
  const { needsFilter, assignedClientIds, ready } = useScope();
  return useQuery({
    queryKey: ['dashboard-admin', 'approved-budgets-no-requests', needsFilter, assignedClientIds],
    enabled: ready && (!needsFilter || assignedClientIds.length > 0),
    queryFn: async (): Promise<ApprovedBudgetWithoutRequests[]> => {
      const firstOfMonth = new Date(CURRENT_YEAR, CURRENT_MONTH - 1, 1).toISOString();

      let q = supabase
        .from('budgets')
        .select('id, code, title, total_amount, created_at, client:clients(id, name)')
        .eq('status', 'approved')
        .lt('created_at', firstOfMonth);
      if (needsFilter) q = q.in('client_id', assignedClientIds);

      const { data: budgets, error } = await q;
      if (error) throw error;
      if (!budgets || budgets.length === 0) return [];

      const ids = budgets.map(b => b.id);
      const { data: reqs, error: rErr } = await supabase
        .from('financial_requests')
        .select('budget_id')
        .in('budget_id', ids)
        .not('budget_id', 'is', null);
      if (rErr) throw rErr;
      const withRequests = new Set((reqs ?? []).map(r => r.budget_id));

      return budgets.filter(b => !withRequests.has(b.id)).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ) as any;
    },
  });
};

export interface PendingBudget {
  id: string;
  code: string;
  title: string;
  total_amount: number | null;
  status: string;
  created_at: string;
  client: { id: string; name: string } | null;
}

export const usePendingBudgets = () => {
  const { needsFilter, assignedClientIds, ready } = useScope();
  return useQuery({
    queryKey: ['dashboard-admin', 'pending-budgets', needsFilter, assignedClientIds],
    enabled: ready && (!needsFilter || assignedClientIds.length > 0),
    queryFn: async (): Promise<PendingBudget[]> => {
      let q = supabase
        .from('budgets')
        .select('id, code, title, total_amount, status, created_at, client:clients(id, name)')
        .in('status', ['pending', 'sent']);
      if (needsFilter) q = q.in('client_id', assignedClientIds);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ) as any;
    },
  });
};

export interface MonthRequest {
  id: string;
  code: string;
  title: string;
  status: string;
  sale_amount: number | null;
  budget_id: string | null;
  contract_id: string | null;
  client: { id: string; name: string } | null;
  specialist: { id: string; name: string } | null;
  budget: { id: string; code: string; title: string; status: string } | null;
  contract: { id: string; code: string; title: string; status: string } | null;
}

export interface ClientGroup {
  client_id: string;
  client_name: string;
  totalAmount: number;
  totalRequests: number;
  origins: OriginGroup[];
}

export interface OriginGroup {
  key: string;
  type: 'budget' | 'contract' | 'none';
  id: string | null;
  code: string | null;
  title: string;
  status: string | null;
  requests: MonthRequest[];
  totalAmount: number;
}

export const useCurrentMonthByClient = () => {
  const { needsFilter, assignedClientIds, ready } = useScope();
  return useQuery({
    queryKey: ['dashboard-admin', 'month-by-client', CURRENT_MONTH, CURRENT_YEAR, needsFilter, assignedClientIds],
    enabled: ready && (!needsFilter || assignedClientIds.length > 0),
    queryFn: async (): Promise<ClientGroup[]> => {
      let q = supabase
        .from('financial_requests')
        .select(`
          id, code, title, status, sale_amount, budget_id, contract_id,
          client:clients(id, name),
          specialist:specialists(id, name),
          budget:budgets(id, code, title, status),
          contract:contracts(id, code, title, status)
        `)
        .eq('work_year', CURRENT_YEAR)
        .eq('work_month', CURRENT_MONTH)
        .eq('is_recurring_template', false);
      if (needsFilter) q = q.in('client_id', assignedClientIds);
      const { data, error } = await q;
      if (error) throw error;

      const requests = (data ?? []) as any as MonthRequest[];

      // group by client → origin
      const clientMap = new Map<string, ClientGroup>();
      for (const r of requests) {
        const clientId = r.client?.id ?? 'unknown';
        const clientName = r.client?.name ?? 'Sin cliente';
        if (!clientMap.has(clientId)) {
          clientMap.set(clientId, {
            client_id: clientId,
            client_name: clientName,
            totalAmount: 0,
            totalRequests: 0,
            origins: [],
          });
        }
        const cg = clientMap.get(clientId)!;
        cg.totalAmount += Number(r.sale_amount ?? 0);
        cg.totalRequests += 1;

        let originKey: string;
        let origin: OriginGroup | undefined;
        if (r.budget) {
          originKey = `b:${r.budget.id}`;
          origin = cg.origins.find(o => o.key === originKey);
          if (!origin) {
            origin = {
              key: originKey, type: 'budget', id: r.budget.id, code: r.budget.code,
              title: r.budget.title, status: r.budget.status, requests: [], totalAmount: 0,
            };
            cg.origins.push(origin);
          }
        } else if (r.contract) {
          originKey = `c:${r.contract.id}`;
          origin = cg.origins.find(o => o.key === originKey);
          if (!origin) {
            origin = {
              key: originKey, type: 'contract', id: r.contract.id, code: r.contract.code,
              title: r.contract.title, status: r.contract.status, requests: [], totalAmount: 0,
            };
            cg.origins.push(origin);
          }
        } else {
          originKey = 'none';
          origin = cg.origins.find(o => o.key === originKey);
          if (!origin) {
            origin = { key: 'none', type: 'none', id: null, code: null, title: 'Sin presupuesto/contrato', status: null, requests: [], totalAmount: 0 };
            cg.origins.push(origin);
          }
        }
        origin.requests.push(r);
        origin.totalAmount += Number(r.sale_amount ?? 0);
      }

      return Array.from(clientMap.values()).sort((a, b) => a.client_name.localeCompare(b.client_name));
    },
  });
};

export const dashboardAdminPeriod = { month: CURRENT_MONTH, year: CURRENT_YEAR };
