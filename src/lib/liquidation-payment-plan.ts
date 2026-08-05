export interface LiquidationPaymentMilestone {
  /** Concepto del hito, p.ej. "Anticipo 50%" */
  label: string;
  /** Porcentaje sobre el total de la liquidación */
  percentage: number;
  /** Importe fijado manualmente. Si existe, manda sobre total × % */
  amount?: number | null;
  /** Fecha prevista/real de pago (YYYY-MM-DD) */
  payment_date: string;
  /** Marcado cuando el pago se ha realizado */
  paid?: boolean;
  /** Fecha en la que se marcó como pagado */
  paid_at?: string | null;
}

export const normalizeLiquidationPaymentPlan = (raw: any): LiquidationPaymentMilestone[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && typeof m === 'object')
    .map((m: any) => ({
      label: String(m.label ?? ''),
      percentage: Number(m.percentage) || 0,
      amount: m.amount == null || m.amount === '' ? null : Number(m.amount),
      payment_date: m.payment_date ?? '',
      paid: !!m.paid,
      paid_at: m.paid_at ?? null,
    }));
};

export const getLiquidationMilestoneAmount = (
  milestone: LiquidationPaymentMilestone,
  total: number
): number => {
  if (milestone.amount != null && !Number.isNaN(milestone.amount)) return Number(milestone.amount);
  return (total * (Number(milestone.percentage) || 0)) / 100;
};

export interface LiquidationPaymentPlanSummary {
  hasPlan: boolean;
  milestones: LiquidationPaymentMilestone[];
  planTotal: number;
  paidAmount: number;
  pendingAmount: number;
  paidPercent: number;
  allPaid: boolean;
  /** Hay pagos realizados pero no todos */
  isPartiallyPaid: boolean;
  /** Próximo hito pendiente (por fecha) */
  nextMilestone: LiquidationPaymentMilestone | null;
}

export const getLiquidationPaymentPlanSummary = (
  rawPlan: any,
  total: number
): LiquidationPaymentPlanSummary => {
  const milestones = normalizeLiquidationPaymentPlan(rawPlan);
  const planTotal = milestones.reduce((s, m) => s + getLiquidationMilestoneAmount(m, total), 0);
  const paidAmount = milestones
    .filter((m) => m.paid)
    .reduce((s, m) => s + getLiquidationMilestoneAmount(m, total), 0);
  const pending = milestones
    .filter((m) => !m.paid && m.payment_date)
    .sort((a, b) => a.payment_date.localeCompare(b.payment_date));
  const reference = total || planTotal;

  return {
    hasPlan: milestones.length > 0,
    milestones,
    planTotal,
    paidAmount,
    pendingAmount: Math.max(0, reference - paidAmount),
    paidPercent: reference > 0 ? (paidAmount / reference) * 100 : 0,
    allPaid: milestones.length > 0 && milestones.every((m) => m.paid),
    isPartiallyPaid:
      milestones.length > 0 && milestones.some((m) => m.paid) && milestones.some((m) => !m.paid),
    nextMilestone: pending[0] ?? null,
  };
};

/**
 * Importe imputable a tesorería (cash-flow) de una liquidación.
 * Con plan de pagos: sólo los hitos marcados como pagados.
 * Sin plan: el total si la liquidación está pagada.
 */
export const getLiquidationCashOutflow = (liquidation: any): number => {
  const total = Number(liquidation?.subtotal ?? liquidation?.total_amount ?? 0);
  const summary = getLiquidationPaymentPlanSummary(liquidation?.payment_plan, total);
  if (summary.hasPlan) return summary.paidAmount;
  return liquidation?.status === 'paid' ? total : 0;
};
