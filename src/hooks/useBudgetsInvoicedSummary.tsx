import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveMilestonesForBudget, PaymentMilestone } from '@/hooks/useBudgetMilestoneResolver';

export interface BudgetInvoicedSummary {
  budgetId: string;
  invoiced: number;
  total: number;
  percent: number;
  invoiceCount: number;
  milestonesTotal: number;
  milestonesCovered: number;
  isSynthetic: boolean;
  nextMilestoneLabel: string | null;
  nextMilestonePercentage: number | null;
}

/**
 * Batch invoicing status for a list of budgets, using the same source of truth
 * as the budget detail (invoice_budget_allocations + payment_plan milestones).
 */
export const useBudgetsInvoicedSummary = (budgets: any[] | undefined) => {
  const budgetIds = useMemo(
    () => Array.from(new Set((budgets || []).map((b) => b.id))).sort(),
    [budgets]
  );

  const totalsKey = useMemo(() => {
    const map = new Map<string, number>();
    (budgets || []).forEach((b) => map.set(b.id, Number(b.total_amount || 0)));
    return map;
  }, [budgets]);

  return useQuery({
    queryKey: ['budgets-invoiced-summary', budgetIds],
    enabled: budgetIds.length > 0,
    queryFn: async () => {
      const out = new Map<string, BudgetInvoicedSummary>();
      if (budgetIds.length === 0) return out;

      const { data: budgetRows, error: bErr } = await supabase
        .from('budgets')
        .select('id, total_amount, payment_plan')
        .in('id', budgetIds);
      if (bErr) throw bErr;

      const { data: allocs, error: aErr } = await supabase
        .from('invoice_budget_allocations')
        .select(`
          invoice_id,
          budget_id,
          allocated_amount,
          invoice:invoices(id, invoice_date, source_milestone_index, budget_id)
        `)
        .in('budget_id', budgetIds);
      if (aErr) throw aErr;

      const byBudget = new Map<string, any[]>();
      for (const a of allocs || []) {
        const inv: any = (a as any).invoice;
        const list = byBudget.get((a as any).budget_id) || [];
        list.push({
          invoice_id: (a as any).invoice_id,
          budget_id: (a as any).budget_id,
          allocated_amount: Number((a as any).allocated_amount),
          invoice_date: inv?.invoice_date ?? null,
          source_milestone_index: inv?.source_milestone_index ?? null,
          invoice_budget_id: inv?.budget_id ?? null,
        });
        byBudget.set((a as any).budget_id, list);
      }

      for (const b of budgetRows || []) {
        const id = (b as any).id as string;
        const total = Number((b as any).total_amount ?? totalsKey.get(id) ?? 0);
        const rawPlan = (b as any).payment_plan;
        const isSynthetic = !Array.isArray(rawPlan) || rawPlan.length === 0;
        const plan: PaymentMilestone[] = isSynthetic
          ? [{ label: 'Facturación única', percentage: 100, invoice_date: null }]
          : (rawPlan as PaymentMilestone[]);

        const list = byBudget.get(id) || [];
        const invoiced = list.reduce((s, a) => s + Number(a.allocated_amount || 0), 0);
        const matches = resolveMilestonesForBudget(total, rawPlan as any, list);

        const coveredIdx = new Set<number>();
        for (const m of matches.values()) {
          if (m.milestoneIndex >= 0) coveredIdx.add(m.milestoneIndex);
        }
        const next = plan.findIndex((_, i) => !coveredIdx.has(i));

        out.set(id, {
          budgetId: id,
          invoiced,
          total,
          percent: total > 0 ? (invoiced / total) * 100 : 0,
          invoiceCount: new Set(list.map((a) => a.invoice_id)).size,
          milestonesTotal: plan.length,
          milestonesCovered: coveredIdx.size,
          isSynthetic,
          nextMilestoneLabel: next >= 0 ? plan[next].label : null,
          nextMilestonePercentage: next >= 0 ? Number(plan[next].percentage) || 0 : null,
        });
      }

      return out;
    },
  });
};
