import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RateSuggestion {
  saleRate: number;
  saleRateSource: 'contract' | 'client' | 'fallback';
  costRate: number;
  costRateSource: 'specialist' | 'fallback';
}

const FALLBACK_SALE_RATE = 70;
const FALLBACK_COST_RATE = 70;

/**
 * Hook that calculates suggested rates based on a hierarchy:
 * 
 * Sale Rate:
 * 1. contract_services (if contract + service + specialist match and price_rule_type = 'hourly')
 * 2. clients.default_hourly_rate (client's default hourly rate)
 * 3. Fallback: 50€/h
 * 
 * Cost Rate:
 * 1. specialists.hourly_rate
 * 2. Fallback: 30€/h
 */
export const useDefaultRates = (
  clientId: string | null,
  contractId: string | null,
  serviceId: string | null,
  specialistId: string | null
) => {
  return useQuery<RateSuggestion>({
    queryKey: ['default-rates', clientId, contractId, serviceId, specialistId],
    queryFn: async () => {
      let saleRate = FALLBACK_SALE_RATE;
      let saleRateSource: 'contract' | 'client' | 'fallback' = 'fallback';
      let costRate = FALLBACK_COST_RATE;
      let costRateSource: 'specialist' | 'fallback' = 'fallback';

      // 1. Try contract_services first (most specific)
      if (contractId && serviceId && specialistId) {
        const { data: contractService } = await supabase
          .from('contract_services')
          .select('price_rule_type, price_value')
          .eq('contract_id', contractId)
          .eq('service_id', serviceId)
          .eq('specialist_id', specialistId)
          .maybeSingle();

        if (contractService?.price_rule_type === 'hourly' && contractService?.price_value) {
          saleRate = contractService.price_value;
          saleRateSource = 'contract';
        }
      }

      // 2. If no contract rate, try client's default rate
      if (saleRateSource === 'fallback' && clientId) {
        const { data: client } = await supabase
          .from('clients')
          .select('default_hourly_rate')
          .eq('id', clientId)
          .maybeSingle();

        if (client?.default_hourly_rate && client.default_hourly_rate > 0) {
          saleRate = client.default_hourly_rate;
          saleRateSource = 'client';
        }
      }

      // 3. Get specialist's hourly rate for cost
      if (specialistId) {
        const { data: specialist } = await supabase
          .from('specialists')
          .select('hourly_rate')
          .eq('id', specialistId)
          .maybeSingle();

        if (specialist?.hourly_rate && specialist.hourly_rate > 0) {
          costRate = specialist.hourly_rate;
          costRateSource = 'specialist';
        }
      }

      return {
        saleRate,
        saleRateSource,
        costRate,
        costRateSource,
      };
    },
    enabled: !!clientId || !!specialistId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Get a human-readable label for the rate source
 */
export const getRateSourceLabel = (
  source: 'contract' | 'client' | 'specialist' | 'fallback',
  entityName?: string
): string => {
  switch (source) {
    case 'contract':
      return `del contrato${entityName ? ` (${entityName})` : ''}`;
    case 'client':
      return `de ${entityName || 'cliente'}`;
    case 'specialist':
      return `de ${entityName || 'especialista'}`;
    case 'fallback':
      return 'por defecto';
    default:
      return '';
  }
};
