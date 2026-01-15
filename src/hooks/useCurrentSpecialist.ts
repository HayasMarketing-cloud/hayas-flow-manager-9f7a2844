import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useCurrentSpecialist = () => {
  const { user } = useAuth();

  const { data: specialist, isLoading } = useQuery({
    queryKey: ['current-specialist', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name, email')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching current specialist:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  return {
    specialist,
    specialistId: specialist?.id || null,
    isLoading,
  };
};
