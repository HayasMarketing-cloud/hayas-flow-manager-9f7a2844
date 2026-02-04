import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useCurrentSpecialist = () => {
  const { user } = useAuth();

  const { data: specialist, isLoading } = useQuery({
    queryKey: ['current-specialist', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // First try to find by user_id (direct link)
      const { data: byUserId, error: userIdError } = await supabase
        .from('specialists')
        .select('id, name, email')
        .eq('user_id', user.id)
        .maybeSingle();

      if (userIdError) {
        console.error('Error fetching current specialist by user_id:', userIdError);
      }
      
      if (byUserId) {
        return byUserId;
      }
      
      // If not found by user_id, try to auto-link by email using the SECURITY DEFINER function
      // This handles the case where specialist exists but user_id wasn't set
      const { data: linkedId, error: linkError } = await supabase
        .rpc('link_my_specialist');
      
      if (linkError) {
        console.error('Error linking specialist:', linkError);
        return null;
      }
      
      if (linkedId) {
        // Successfully linked, fetch the specialist data
        const { data: linked, error: fetchError } = await supabase
          .from('specialists')
          .select('id, name, email')
          .eq('id', linkedId)
          .maybeSingle();
        
        if (fetchError) {
          console.error('Error fetching linked specialist:', fetchError);
          return null;
        }
        
        return linked;
      }
      
      return null;
    },
    enabled: !!user?.id,
  });

  return {
    specialist,
    specialistId: specialist?.id || null,
    isLoading,
  };
};
