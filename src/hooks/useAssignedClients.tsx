import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from './useUserRole';

/**
 * Hook to get client IDs assigned to the current user as AM or PM.
 * Returns unique client IDs from contracts and budgets where the user is assigned.
 */
export const useAssignedClients = () => {
  const { user } = useAuth();
  const { shouldFilterByAssignment, loading: rolesLoading } = useUserRole();
  
  // CRITICAL: Only determine needsFiltering when roles are fully loaded
  // This prevents the race condition where needsFiltering=true temporarily for admins
  const needsFiltering = !rolesLoading && shouldFilterByAssignment();

  const { data: assignedClientIds = [], isLoading } = useQuery({
    queryKey: ['assigned-clients', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get client IDs from client_assignments (direct client-level access)
      const { data: assignedClients, error: assignmentError } = await supabase
        .from('client_assignments')
        .select('client_id')
        .eq('user_id', user.id);

      if (assignmentError) {
        console.error('Error fetching client assignments:', assignmentError);
      }

      // Get client IDs from contracts where user is AM or PM
      const { data: contractClients, error: contractError } = await supabase
        .from('contracts')
        .select('client_id')
        .or(`am_user_id.eq.${user.id},pm_user_id.eq.${user.id}`);

      if (contractError) {
        console.error('Error fetching contract clients:', contractError);
      }

      // Get client IDs from budgets where user is AM or PM
      const { data: budgetClients, error: budgetError } = await supabase
        .from('budgets')
        .select('client_id')
        .or(`am_user_id.eq.${user.id},pm_user_id.eq.${user.id}`);

      if (budgetError) {
        console.error('Error fetching budget clients:', budgetError);
      }

      // Combine and deduplicate client IDs
      const allClientIds = [
        ...(assignedClients?.map(a => a.client_id) || []),
        ...(contractClients?.map(c => c.client_id) || []),
        ...(budgetClients?.map(b => b.client_id) || [])
      ];

      return [...new Set(allClientIds)];
    },
    enabled: !!user?.id && !rolesLoading && needsFiltering,
  });

  return {
    assignedClientIds,
    isLoading: rolesLoading || (needsFiltering && isLoading),
    needsFiltering,
  };
};

/**
 * Hook to check if the current user is assigned to a specific contract (as AM or PM)
 */
export const useUserContractIds = () => {
  const { user } = useAuth();
  const { shouldFilterByAssignment, loading: rolesLoading } = useUserRole();
  
  // CRITICAL: Only determine needsFiltering when roles are fully loaded
  const needsFiltering = !rolesLoading && shouldFilterByAssignment();

  const { data: assignedContractIds = [], isLoading } = useQuery({
    queryKey: ['assigned-contracts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('contracts')
        .select('id')
        .or(`am_user_id.eq.${user.id},pm_user_id.eq.${user.id}`);

      if (error) {
        console.error('Error fetching assigned contracts:', error);
        return [];
      }

      return data?.map(c => c.id) || [];
    },
    enabled: !!user?.id && !rolesLoading && needsFiltering,
  });

  return {
    assignedContractIds,
    isLoading: rolesLoading || (needsFiltering && isLoading),
    needsFiltering,
  };
};

/**
 * Hook to get budget IDs assigned to the current user as AM or PM
 */
export const useUserBudgetIds = () => {
  const { user } = useAuth();
  const { shouldFilterByAssignment, loading: rolesLoading } = useUserRole();
  
  // CRITICAL: Only determine needsFiltering when roles are fully loaded
  const needsFiltering = !rolesLoading && shouldFilterByAssignment();

  const { data: assignedBudgetIds = [], isLoading } = useQuery({
    queryKey: ['assigned-budgets', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: directBudgets, error: directBudgetError } = await supabase
        .from('budgets')
        .select('id')
        .or(`am_user_id.eq.${user.id},pm_user_id.eq.${user.id},created_by.eq.${user.id}`);

      if (directBudgetError) {
        console.error('Error fetching directly assigned budgets:', directBudgetError);
      }

      const { data: assignedClients, error: assignmentError } = await supabase
        .from('client_assignments')
        .select('client_id')
        .eq('user_id', user.id);

      if (assignmentError) {
        console.error('Error fetching budget client assignments:', assignmentError);
      }

      const { data: contractClients, error: contractError } = await supabase
        .from('contracts')
        .select('client_id')
        .or(`am_user_id.eq.${user.id},pm_user_id.eq.${user.id}`);

      if (contractError) {
        console.error('Error fetching budget contract clients:', contractError);
      }

      const clientIds = [...new Set([
        ...(assignedClients?.map(a => a.client_id) || []),
        ...(contractClients?.map(c => c.client_id) || []),
      ].filter(Boolean))];

      let clientBudgets: { id: string }[] = [];
      if (clientIds.length > 0) {
        const { data, error } = await supabase
          .from('budgets')
          .select('id')
          .in('client_id', clientIds);

        if (error) {
          console.error('Error fetching budgets for assigned clients:', error);
        } else {
          clientBudgets = data || [];
        }
      }

      return [...new Set([
        ...(directBudgets?.map(b => b.id) || []),
        ...clientBudgets.map(b => b.id),
      ])];
    },
    enabled: !!user?.id && !rolesLoading && needsFiltering,
  });

  return {
    assignedBudgetIds,
    isLoading: rolesLoading || (needsFiltering && isLoading),
    needsFiltering,
  };
};
