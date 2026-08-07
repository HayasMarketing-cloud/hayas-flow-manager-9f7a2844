import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildProjectLens, type LensRequest, type OriginMeta } from '@/lib/projects-view-aggregation';

/**
 * Lente "Proyectos" (F6): una única lectura de `financial_requests` con joins
 * ligeros. La RLS existente ya restringe las filas visibles por rol; no se
 * añaden funciones ni vistas de BD. La agregación se hace en memoria.
 */
export const useProjectsLens = (options?: { clientId?: string; enabled?: boolean }) => {
  const clientId = options?.clientId;

  return useQuery({
    queryKey: ['projects-lens', clientId ?? 'all'],
    enabled: options?.enabled !== false,
    queryFn: async () => {
      let query = supabase
        .from('financial_requests')
        .select(`
          id, code, title, status, phase, deadline, hours,
          cost_to_agency, sale_amount,
          budget_id, contract_id, client_id, specialist_id,
          is_recurring_template, template_source_id,
          client:clients(id, name),
          specialist:specialists(id, name),
          budget:budgets(id, title, code, client_id),
          contract:contracts(id, title, code, client_id)
        `)
        .order('deadline', { ascending: true, nullsFirst: false });

      if (clientId) query = query.eq('client_id', clientId);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []).filter(
        (r: any) => !(r.is_recurring_template === true && !r.template_source_id),
      );

      const meta: OriginMeta = { budgets: {}, contracts: {} };
      const requests: LensRequest[] = rows.map((r: any) => {
        if (r.budget_id && r.budget) {
          meta.budgets[r.budget_id] = {
            title: r.budget.title,
            code: r.budget.code ?? null,
            clientId: r.budget.client_id ?? null,
            clientName: r.client?.name ?? null,
          };
        }
        if (r.contract_id && r.contract) {
          meta.contracts[r.contract_id] = {
            title: r.contract.title,
            code: r.contract.code ?? null,
            clientId: r.contract.client_id ?? null,
            clientName: r.client?.name ?? null,
          };
        }
        return {
          id: r.id,
          code: r.code,
          title: r.title,
          status: r.status,
          phase: r.phase ?? null,
          deadline: r.deadline ?? null,
          hours: r.hours,
          cost_to_agency: r.cost_to_agency,
          sale_amount: r.sale_amount,
          budget_id: r.budget_id ?? null,
          contract_id: r.contract_id ?? null,
          client_id: r.client_id ?? null,
          specialist_id: r.specialist_id ?? null,
          clientName: r.client?.name ?? null,
          specialistName: r.specialist?.name ?? null,
        };
      });

      return {
        requests,
        groups: buildProjectLens(requests, meta),
      };
    },
  });
};
