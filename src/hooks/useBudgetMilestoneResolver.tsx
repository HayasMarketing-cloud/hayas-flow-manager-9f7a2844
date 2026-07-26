import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

export interface PaymentMilestone {
  label: string;
  percentage: number;
  invoice_date: string | null;
}

export interface MilestoneMatch {
  milestoneIndex: number; // -1 = synthetic single-100, -2 = additional (no milestone)
  milestoneLabel: string;
  milestonePercentage: number; // % of budget defined by the milestone
  allocationPercentage: number; // % of budget covered by this allocation
  allocatedAmount: number;
  matchType: 'index' | 'fallback' | 'single-100' | 'additional';
}

const PERCENT_TOLERANCE = 2; // percentage points

const daysBetween = (a?: string | null, b?: string | null): number => {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(da - db) / 86400000;
};

interface RawAlloc {
  invoice_id: string;
  budget_id: string;
  allocated_amount: number;
  invoice_date: string | null;
  source_milestone_index: number | null;
  invoice_budget_id: string | null; // invoices.budget_id (source of milestone index)
}

/**
 * Pure resolver — given a budget's plan + total, and every allocation touching
 * that budget (across ALL invoices, not just visible ones), decide which
 * milestone each allocation covers. Deterministic:
 *   Pass A: honour source_milestone_index (only for the invoice's source budget).
 *   Pass B: fallback by % + date proximity over unclaimed milestones.
 *   Rest: mark as "additional".
 */
export function resolveMilestonesForBudget(
  budgetTotal: number,
  plan: PaymentMilestone[] | null,
  allocations: RawAlloc[]
): Map<string, MilestoneMatch> {
  const result = new Map<string, MilestoneMatch>();
  const total = Number(budgetTotal || 0);

  // Synthetic single-100 milestone if plan missing/empty
  const effectivePlan: PaymentMilestone[] =
    Array.isArray(plan) && plan.length > 0
      ? plan
      : [{ label: 'Facturación única', percentage: 100, invoice_date: null }];
  const isSynthetic = !Array.isArray(plan) || plan.length === 0;

  // Deterministic ordering: date ASC, then invoice_id ASC
  const ordered = [...allocations].sort((a, b) => {
    const da = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
    const db = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
    if (da !== db) return da - db;
    return a.invoice_id.localeCompare(b.invoice_id);
  });

  const claimed = new Set<number>();
  const remaining: RawAlloc[] = [];

  // Pass A — index wins, only if allocation belongs to the invoice's source budget
  for (const a of ordered) {
    const key = `${a.invoice_id}::${a.budget_id}`;
    const idx = a.source_milestone_index;
    const sameBudget = a.invoice_budget_id && a.invoice_budget_id === a.budget_id;
    if (
      idx !== null &&
      idx !== undefined &&
      sameBudget &&
      idx >= 0 &&
      idx < effectivePlan.length &&
      !claimed.has(idx)
    ) {
      claimed.add(idx);
      const m = effectivePlan[idx];
      const allocPct = total > 0 ? (Number(a.allocated_amount) / total) * 100 : 0;
      result.set(key, {
        milestoneIndex: idx,
        milestoneLabel: m.label,
        milestonePercentage: Number(m.percentage) || 0,
        allocationPercentage: allocPct,
        allocatedAmount: Number(a.allocated_amount),
        matchType: isSynthetic ? 'single-100' : 'index',
      });
    } else {
      remaining.push(a);
    }
  }

  // Pass B — fallback by % + date over unclaimed
  for (const a of remaining) {
    const key = `${a.invoice_id}::${a.budget_id}`;
    const allocPct = total > 0 ? (Number(a.allocated_amount) / total) * 100 : 0;
    const unclaimedIdx = effectivePlan
      .map((m, i) => ({ m, i }))
      .filter((x) => !claimed.has(x.i));

    if (unclaimedIdx.length === 0) {
      result.set(key, {
        milestoneIndex: -2,
        milestoneLabel: 'Factura adicional',
        milestonePercentage: 0,
        allocationPercentage: allocPct,
        allocatedAmount: Number(a.allocated_amount),
        matchType: 'additional',
      });
      continue;
    }

    // Prefer matches within % tolerance, tie-break by closest date
    const byPct = unclaimedIdx
      .filter((x) => Math.abs((Number(x.m.percentage) || 0) - allocPct) <= PERCENT_TOLERANCE)
      .sort(
        (x, y) => daysBetween(x.m.invoice_date, a.invoice_date) - daysBetween(y.m.invoice_date, a.invoice_date)
      );

    let chosen = byPct[0];
    if (!chosen) {
      // No % match — pick the earliest unclaimed milestone by date, then by index
      chosen = [...unclaimedIdx].sort((x, y) => {
        const dx = daysBetween(x.m.invoice_date, a.invoice_date);
        const dy = daysBetween(y.m.invoice_date, a.invoice_date);
        if (dx !== dy) return dx - dy;
        return x.i - y.i;
      })[0];
    }

    claimed.add(chosen.i);
    result.set(key, {
      milestoneIndex: chosen.i,
      milestoneLabel: chosen.m.label,
      milestonePercentage: Number(chosen.m.percentage) || 0,
      allocationPercentage: allocPct,
      allocatedAmount: Number(a.allocated_amount),
      matchType: isSynthetic ? 'single-100' : 'fallback',
    });
  }

  return result;
}

/**
 * Resolves milestones for a list of invoices (used in the invoices list).
 * Fetches every allocation on the involved budgets (not filtered by the
 * visible invoice window) so the result is stable regardless of filters.
 *
 * Returns Map<invoiceId, Array<MilestoneMatch & {budgetId, budgetCode, budgetTitle}>>
 */
export function useInvoiceListMilestoneResolver(invoices: any[] | undefined) {
  const invoiceIds = useMemo(
    () => (invoices || []).map((i) => i.id).sort(),
    [invoices]
  );

  return useQuery({
    queryKey: ['budget-milestone-resolver', invoiceIds],
    enabled: invoiceIds.length > 0,
    queryFn: async () => {
      const empty = new Map<string, Array<MilestoneMatch & { budgetId: string; budgetCode: string; budgetTitle: string }>>();
      if (invoiceIds.length === 0) return empty;

      // 1. Allocations for the visible invoices — get the budget ids we touch
      const { data: visibleAllocs, error: err1 } = await supabase
        .from('invoice_budget_allocations')
        .select('invoice_id, budget_id, allocated_amount')
        .in('invoice_id', invoiceIds);
      if (err1) throw err1;

      const budgetIds = Array.from(new Set((visibleAllocs || []).map((a: any) => a.budget_id)));
      if (budgetIds.length === 0) return empty;

      // 2. All allocations for those budgets (any invoice) with invoice metadata
      const { data: allAllocs, error: err2 } = await supabase
        .from('invoice_budget_allocations')
        .select(`
          invoice_id,
          budget_id,
          allocated_amount,
          invoice:invoices(id, invoice_date, source_milestone_index, budget_id)
        `)
        .in('budget_id', budgetIds);
      if (err2) throw err2;

      // 3. Budgets with plan + total
      const { data: budgets, error: err3 } = await supabase
        .from('budgets')
        .select('id, code, title, total_amount, payment_plan')
        .in('id', budgetIds);
      if (err3) throw err3;

      const budgetMap = new Map<string, any>((budgets || []).map((b: any) => [b.id, b]));

      // Group allocations by budget
      const byBudget = new Map<string, RawAlloc[]>();
      for (const a of allAllocs || []) {
        const inv: any = (a as any).invoice;
        const raw: RawAlloc = {
          invoice_id: (a as any).invoice_id,
          budget_id: (a as any).budget_id,
          allocated_amount: Number((a as any).allocated_amount),
          invoice_date: inv?.invoice_date ?? null,
          source_milestone_index: inv?.source_milestone_index ?? null,
          invoice_budget_id: inv?.budget_id ?? null,
        };
        const list = byBudget.get(raw.budget_id) || [];
        list.push(raw);
        byBudget.set(raw.budget_id, list);
      }

      // Resolve per budget
      const resolvedByBudget = new Map<string, Map<string, MilestoneMatch>>();
      for (const [bId, allocs] of byBudget.entries()) {
        const b = budgetMap.get(bId);
        if (!b) continue;
        resolvedByBudget.set(
          bId,
          resolveMilestonesForBudget(Number(b.total_amount || 0), b.payment_plan as any, allocs)
        );
      }

      // Assemble per-invoice output limited to visible invoices
      const out = new Map<string, Array<MilestoneMatch & { budgetId: string; budgetCode: string; budgetTitle: string }>>();
      for (const invId of invoiceIds) {
        const list: Array<MilestoneMatch & { budgetId: string; budgetCode: string; budgetTitle: string }> = [];
        for (const [bId, matches] of resolvedByBudget.entries()) {
          const m = matches.get(`${invId}::${bId}`);
          if (!m) continue;
          const b = budgetMap.get(bId);
          list.push({
            ...m,
            budgetId: bId,
            budgetCode: b?.code || '',
            budgetTitle: b?.title || '',
          });
        }
        if (list.length > 0) out.set(invId, list);
      }

      return out;
    },
  });
}

export interface BudgetMilestoneBreakdown {
  budgetTotal: number;
  plan: PaymentMilestone[];
  isSynthetic: boolean;
  milestones: Array<{
    index: number;
    milestone: PaymentMilestone;
    match:
      | (MilestoneMatch & {
          invoiceId: string;
          invoiceCode: string;
          invoiceStatus: string;
          invoiceDate: string | null;
          pdfUrl: string | null;
        })
      | null;
  }>;
  additional: Array<
    MilestoneMatch & {
      invoiceId: string;
      invoiceCode: string;
      invoiceStatus: string;
      invoiceDate: string | null;
      pdfUrl: string | null;
    }
  >;
  totalInvoiced: number;
  percentCovered: number;
}

/**
 * Breakdown for a SINGLE budget: milestone-by-milestone status + any extra
 * invoices without a milestone slot. Used by the budget detail card.
 */
export function useBudgetMilestoneBreakdown(budgetId?: string) {
  return useQuery({
    queryKey: ['budget-milestone-resolver', 'budget', budgetId],
    enabled: !!budgetId,
    queryFn: async (): Promise<BudgetMilestoneBreakdown | null> => {
      if (!budgetId) return null;

      const { data: budget, error: bErr } = await supabase
        .from('budgets')
        .select('id, total_amount, payment_plan')
        .eq('id', budgetId)
        .maybeSingle();
      if (bErr) throw bErr;
      if (!budget) return null;

      const { data: allocs, error: aErr } = await supabase
        .from('invoice_budget_allocations')
        .select(`
          invoice_id,
          budget_id,
          allocated_amount,
          invoice:invoices(id, code, status, invoice_date, source_milestone_index, budget_id, pdf_url)
        `)
        .eq('budget_id', budgetId);
      if (aErr) throw aErr;

      const budgetTotal = Number(budget.total_amount || 0);
      const rawPlan = budget.payment_plan as any;
      const plan: PaymentMilestone[] =
        Array.isArray(rawPlan) && rawPlan.length > 0
          ? (rawPlan as PaymentMilestone[])
          : [{ label: 'Facturación única', percentage: 100, invoice_date: null }];
      const isSynthetic = !Array.isArray(rawPlan) || rawPlan.length === 0;

      const rawAllocs: RawAlloc[] = (allocs || []).map((a: any) => ({
        invoice_id: a.invoice_id,
        budget_id: a.budget_id,
        allocated_amount: Number(a.allocated_amount),
        invoice_date: a.invoice?.invoice_date ?? null,
        source_milestone_index: a.invoice?.source_milestone_index ?? null,
        invoice_budget_id: a.invoice?.budget_id ?? null,
      }));
      const invoiceMetaMap = new Map<string, any>();
      for (const a of allocs || []) {
        if ((a as any).invoice) invoiceMetaMap.set((a as any).invoice_id, (a as any).invoice);
      }

      const matches = resolveMilestonesForBudget(budgetTotal, rawPlan as any, rawAllocs);

      // Build milestone slots
      const byMilestone = new Map<number, any>();
      const additional: any[] = [];
      for (const [key, m] of matches.entries()) {
        const invoiceId = key.split('::')[0];
        const inv = invoiceMetaMap.get(invoiceId);
        const enriched = {
          ...m,
          invoiceId,
          invoiceCode: inv?.code || '',
          invoiceStatus: inv?.status || '',
          invoiceDate: inv?.invoice_date || null,
          pdfUrl: inv?.pdf_url || null,
        };
        if (m.milestoneIndex >= 0) {
          byMilestone.set(m.milestoneIndex, enriched);
        } else {
          additional.push(enriched);
        }
      }

      const milestones = plan.map((milestone, index) => ({
        index,
        milestone,
        match: byMilestone.get(index) || null,
      }));

      const totalInvoiced = rawAllocs.reduce((s, a) => s + Number(a.allocated_amount || 0), 0);
      const percentCovered = budgetTotal > 0 ? (totalInvoiced / budgetTotal) * 100 : 0;

      return {
        budgetTotal,
        plan,
        isSynthetic,
        milestones,
        additional,
        totalInvoiced,
        percentCovered,
      };
    },
  });
}
