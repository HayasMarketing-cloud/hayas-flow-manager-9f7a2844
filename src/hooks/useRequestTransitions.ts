import { useQuery } from '@tanstack/react-query';
import { fetchAllowedTransitions, RequestStatus } from '@/lib/request-status-utils';

/**
 * Transiciones válidas desde un estado, derivadas de la fuente única en BD.
 */
export const useRequestTransitions = (from?: RequestStatus | null) => {
  const query = useQuery({
    queryKey: ['request-transitions', from],
    queryFn: () => fetchAllowedTransitions(from as RequestStatus),
    enabled: !!from,
    staleTime: 5 * 60 * 1000,
  });

  return {
    allowed: query.data ?? [],
    loading: query.isLoading,
  };
};
