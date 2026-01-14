import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useBudgetDetail = (budgetId: string | undefined) => {
  return useQuery({
    queryKey: ['budget-detail', budgetId],
    queryFn: async () => {
      if (!budgetId) throw new Error('Budget ID is required');

      // Fetch budget with client, contract, and AM/PM profiles
      const { data: budget, error: budgetError } = await supabase
        .from('budgets')
        .select(`
          *,
          client:clients(id, name, code),
          contract:contracts(id, title, code),
          am_profile:profiles!budgets_am_user_id_fkey(id, full_name, email),
          pm_profile:profiles!budgets_pm_user_id_fkey(id, full_name, email)
        `)
        .eq('id', budgetId)
        .single();

      if (budgetError) throw budgetError;

      // Fetch budget items with services and specialists
      const { data: items, error: itemsError } = await supabase
        .from('budget_items')
        .select(`
          *,
          service:services(id, name, category),
          specialist:specialists(id, name, type, email)
        `)
        .eq('budget_id', budgetId)
        .order('created_at');

      if (itemsError) throw itemsError;

      // Fetch financial requests linked to this budget
      const { data: requests, error: requestsError } = await supabase
        .from('financial_requests')
        .select(`
          *,
          service:services(name),
          specialist:specialists(name),
          billed_invoice:invoices(id, code, status, total_amount)
        `)
        .eq('budget_id', budgetId)
        .order('created_at');

      if (requestsError) throw requestsError;

      // Fetch operational projects linked to this budget
      const { data: projects, error: projectsError } = await supabase
        .from('operational_projects')
        .select(`
          *,
          operational_requests:operational_requests(
            id,
            name,
            status,
            deadline
          )
        `)
        .eq('budget_id', budgetId);

      if (projectsError) throw projectsError;

      // Fetch creator profile (Account Manager)
      let creatorProfile = null;
      if (budget.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', budget.created_by)
          .single();
        creatorProfile = profile;
      }

      return {
        budget,
        items: items || [],
        requests: requests || [],
        projects: projects || [],
        creatorProfile,
        amProfile: budget.am_profile || null,
        pmProfile: budget.pm_profile || null,
      };
    },
    enabled: !!budgetId,
  });
};
