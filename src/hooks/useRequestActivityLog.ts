import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LogActivityParams {
  entityId: string;
  action: string;
  changes?: Record<string, any>;
}

export const useRequestActivityLog = () => {
  const { user } = useAuth();

  const logActivity = async ({ entityId, action, changes }: LogActivityParams) => {
    if (!user?.id) {
      console.warn('Cannot log activity: no user authenticated');
      return false;
    }

    try {
      const { error } = await supabase.from('activity_log').insert({
        user_id: user.id,
        entity_type: 'financial_request',
        entity_id: entityId,
        action,
        changes: changes || null,
      });

      if (error) {
        console.error('Error logging activity:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error logging activity:', error);
      return false;
    }
  };

  return { logActivity };
};
