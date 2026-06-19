import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface AmReview {
  id: string;
  liquidation_id: string;
  am_user_id: string;
  status: 'pending' | 'validated' | 'issue';
  notes: string | null;
  requested_at: string;
  reviewed_at: string | null;
  am?: { id: string; email: string | null; full_name: string | null } | null;
}

export type AmAggregateStatus = 'none' | 'pending' | 'issue' | 'validated';

export function useLiquidationAmReviews(liquidationId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['liquidation-am-reviews', liquidationId],
    queryFn: async (): Promise<AmReview[]> => {
      if (!liquidationId) return [];
      const { data, error } = await supabase
        .from('liquidation_am_reviews')
        .select('*')
        .eq('liquidation_id', liquidationId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Fetch profile info for each AM
      const ids = Array.from(new Set((data || []).map(r => r.am_user_id)));
      let profiles: any[] = [];
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', ids);
        profiles = profs || [];
      }
      return (data || []).map(r => ({
        ...r,
        am: profiles.find(p => p.id === r.am_user_id) || null,
      })) as AmReview[];
    },
    enabled: !!liquidationId,
  });

  const sendForValidation = useMutation({
    mutationFn: async () => {
      if (!liquidationId) throw new Error('liquidation_id missing');
      const { data, error } = await supabase.functions.invoke('send-liquidation-am-validation', {
        body: {
          liquidation_id: liquidationId,
          app_url: window.location.origin,
          sender_email: user?.email,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      return data as { am_count: number; emails_sent: number };
    },
    onSuccess: (data) => {
      toast.success(`Enviado a ${data.am_count} AM (${data.emails_sent} email${data.emails_sent === 1 ? '' : 's'})`);
      qc.invalidateQueries({ queryKey: ['liquidation-am-reviews', liquidationId] });
    },
    onError: (e: any) => {
      toast.error(e.message || 'Error al enviar a AM');
    },
  });

  const respondAsAm = useMutation({
    mutationFn: async ({ status, notes }: { status: 'validated' | 'issue'; notes: string }) => {
      if (!liquidationId || !user) throw new Error('not ready');
      const { error } = await supabase
        .from('liquidation_am_reviews')
        .update({ status, notes: notes || null })
        .eq('liquidation_id', liquidationId)
        .eq('am_user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tu respuesta se ha guardado');
      qc.invalidateQueries({ queryKey: ['liquidation-am-reviews', liquidationId] });
    },
    onError: (e: any) => toast.error(e.message || 'Error al guardar'),
  });

  const reviews = query.data || [];
  const myReview = user ? reviews.find(r => r.am_user_id === user.id) : undefined;
  const total = reviews.length;
  const validated = reviews.filter(r => r.status === 'validated').length;
  const hasIssue = reviews.some(r => r.status === 'issue');
  const allValidated = total > 0 && validated === total;
  const aggregateStatus: AmAggregateStatus =
    total === 0 ? 'none' : hasIssue ? 'issue' : allValidated ? 'validated' : 'pending';

  return {
    reviews,
    myReview,
    total,
    validated,
    hasIssue,
    allValidated,
    aggregateStatus,
    isLoading: query.isLoading,
    sendForValidation,
    respondAsAm,
  };
}
