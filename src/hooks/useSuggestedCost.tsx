import { supabase } from '@/integrations/supabase/client';

export const useSuggestedCost = async (requestId: string) => {
  // Obtener datos de la request
  const { data: request } = await supabase
    .from('financial_requests')
    .select('contract_id, specialist_id, service_id, cost_type, hours')
    .eq('id', requestId)
    .maybeSingle();

  if (!request) return 0;

  // Buscar en contract_services si hay contrato y especialista
  if (request.contract_id && request.specialist_id) {
    const { data: contractService } = await supabase
      .from('contract_services')
      .select('price_rule_type, price_value')
      .eq('contract_id', request.contract_id)
      .eq('service_id', request.service_id)
      .eq('specialist_id', request.specialist_id)
      .maybeSingle();
    
    if (contractService?.price_value) {
      // Si es hourly y tenemos horas, multiplicar
      if (contractService.price_rule_type === 'hourly' && request.hours) {
        return contractService.price_value * request.hours;
      }
      // Si es fixed, devolver el valor directamente
      return contractService.price_value;
    }
  }

  // Si no hay en contrato, buscar default_rate del especialista
  if (request.specialist_id) {
    const { data: specialist } = await supabase
      .from('specialists')
      .select('default_rate, cost_type')
      .eq('id', request.specialist_id)
      .maybeSingle();
    
    if (specialist?.default_rate) {
      // Si es hourly y tenemos horas, multiplicar
      if (specialist.cost_type === 'hourly' && request.hours) {
        return specialist.default_rate * request.hours;
      }
      // Si es fixed, devolver el valor directamente
      return specialist.default_rate;
    }
  }

  return 0;
};
