import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type LiquidationItemType = 'work' | 'advance' | 'advance_settlement';

export interface PendingAdvance {
  item_id: string;
  description: string;
  amount: number;
  pending: number;
  liquidation_id: string;
  liquidation_code: string;
  period_year: number;
  period_month: number;
  created_at: string;
  source_invoice_id: string | null;
  invoice_code: string | null;
}

export const getItemType = (item: any): LiquidationItemType =>
  (item?.item_type as LiquidationItemType) || 'work';

export const isAdvanceItem = (item: any) => getItemType(item) === 'advance';
export const isSettlementItem = (item: any) => getItemType(item) === 'advance_settlement';
export const isAdvanceRelated = (item: any) => isAdvanceItem(item) || isSettlementItem(item);

/**
 * Separa líneas de trabajo (que se agrupan por cliente/proyecto) de las
 * líneas de anticipo y regularización, que van en un bloque propio.
 */
export const splitItemsByType = (items: any[]) => {
  const work: any[] = [];
  const advances: any[] = [];
  (items || []).forEach((item) => (isAdvanceRelated(item) ? advances : work).push(item));
  return { work, advances };
};

/**
 * Anticipos con saldo distinto de cero para un especialista.
 * El saldo se deriva siempre en BD; nunca se almacena.
 * `pending > 0` → pendiente de regularizar.
 * `pending < 0` → regularizado en exceso (a favor del especialista).
 */
export const useSpecialistPendingAdvances = (specialistId?: string | null) =>
  useQuery({
    queryKey: ['specialist-pending-advances', specialistId],
    enabled: !!specialistId,
    queryFn: async (): Promise<PendingAdvance[]> => {
      const { data, error } = await (supabase as any).rpc('specialist_pending_advances', {
        _specialist_id: specialistId,
      });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        amount: Number(row.amount) || 0,
        pending: Number(row.pending) || 0,
      }));
    },
  });

export const formatAdvancePeriod = (a: PendingAdvance) =>
  new Date(a.period_year, (a.period_month || 1) - 1)
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
