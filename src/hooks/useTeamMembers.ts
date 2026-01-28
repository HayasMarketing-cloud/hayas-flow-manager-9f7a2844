import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  type: string | null;
  team_leader_id: string | null;
}

interface TeamLiquidation {
  id: string;
  code: string;
  specialist_id: string;
  specialist: { id: string; name: string; email: string | null };
  status: string;
  subtotal: number;
  total_amount: number;
  period_month: number;
  period_year: number;
  liquidation_items: {
    id: string;
    total: number;
    description: string;
    financial_request?: {
      id: string;
      code: string;
      title: string;
      cost_to_agency: number | null;
      client?: { id: string; name: string } | null;
    } | null;
  }[];
}

/**
 * Hook to get team members for a given specialist (leader)
 */
export const useTeamMembers = (specialistId: string | undefined) => {
  return useQuery({
    queryKey: ['team-members', specialistId],
    queryFn: async () => {
      if (!specialistId) return [];

      const { data, error } = await supabase
        .from('specialists')
        .select('id, name, email, type, team_leader_id')
        .eq('team_leader_id', specialistId)
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!specialistId,
  });
};

/**
 * Hook to get all liquidations for a team (leader + members) for a specific period
 */
export const useTeamLiquidations = (
  leaderId: string | undefined,
  periodYear: number,
  periodMonth: number
) => {
  return useQuery({
    queryKey: ['team-liquidations', leaderId, periodYear, periodMonth],
    queryFn: async () => {
      if (!leaderId) return { leader: null, members: [] };

      // First, get team members
      const { data: members, error: membersError } = await supabase
        .from('specialists')
        .select('id, name')
        .eq('team_leader_id', leaderId)
        .eq('active', true);

      if (membersError) throw membersError;

      // Get all specialist IDs (leader + members)
      const allSpecialistIds = [leaderId, ...(members?.map(m => m.id) || [])];

      // Fetch liquidations for all team members for this period
      const { data: liquidations, error: liqError } = await supabase
        .from('liquidations')
        .select(`
          id,
          code,
          specialist_id,
          specialist:specialists(id, name, email),
          status,
          subtotal,
          total_amount,
          period_month,
          period_year,
          liquidation_items(
            id,
            total,
            description,
            financial_request:financial_requests(
              id,
              code,
              title,
              cost_to_agency,
              client:clients(id, name)
            )
          )
        `)
        .in('specialist_id', allSpecialistIds)
        .eq('period_year', periodYear)
        .eq('period_month', periodMonth);

      if (liqError) throw liqError;

      // Separate leader and member liquidations
      const leaderLiq = liquidations?.find(l => l.specialist_id === leaderId) || null;
      const memberLiqs = liquidations?.filter(l => l.specialist_id !== leaderId) || [];

      // Calculate totals
      const leaderTotal = leaderLiq?.liquidation_items?.reduce(
        (sum, item) => sum + (Number(item.total) || 0), 0
      ) || 0;

      const memberTotals = memberLiqs.map(liq => ({
        ...liq,
        calculated_total: liq.liquidation_items?.reduce(
          (sum, item) => sum + (Number(item.total) || 0), 0
        ) || 0,
      }));

      const teamTotal = leaderTotal + memberTotals.reduce((sum, m) => sum + m.calculated_total, 0);

      return {
        leader: leaderLiq ? { ...leaderLiq, calculated_total: leaderTotal } : null,
        members: memberTotals,
        teamTotal,
        hasTeam: (members?.length || 0) > 0,
      };
    },
    enabled: !!leaderId && !!periodYear && !!periodMonth,
  });
};

/**
 * Check if a specialist is a team leader (has members)
 */
export const useIsTeamLeader = (specialistId: string | undefined) => {
  return useQuery({
    queryKey: ['is-team-leader', specialistId],
    queryFn: async () => {
      if (!specialistId) return false;

      const { count, error } = await supabase
        .from('specialists')
        .select('id', { count: 'exact', head: true })
        .eq('team_leader_id', specialistId)
        .eq('active', true);

      if (error) throw error;
      return (count || 0) > 0;
    },
    enabled: !!specialistId,
  });
};
