import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type InvoiceLinkVia = 'direct' | 'budget' | 'contract';

export interface ResolvedInvoiceLink {
  invoiceId: string;
  code: string | null;
  status: string | null;
  via: InvoiceLinkVia;
  budgetCode?: string | null;
  contractCode?: string | null;
  extraCount?: number;
}

interface RequestLike {
  id: string;
  billed_invoice_id?: string | null;
  budget_id?: string | null;
  contract_id?: string | null;
  work_month?: number | null;
  work_year?: number | null;
  invoice?: { code?: string | null; status?: string | null } | null;
}

export const useRequestInvoiceLinks = (requests: RequestLike[] | undefined) => {
  const budgetIds = useMemo(() => {
    const s = new Set<string>();
    requests?.forEach((r) => {
      if (!r.billed_invoice_id && r.budget_id) s.add(r.budget_id);
    });
    return Array.from(s);
  }, [requests]);

  const contractCandidates = useMemo(() => {
    return (requests ?? []).filter(
      (r) => !r.billed_invoice_id && !r.budget_id && r.contract_id
    );
  }, [requests]);

  const contractIds = useMemo(() => {
    const s = new Set<string>();
    contractCandidates.forEach((r) => r.contract_id && s.add(r.contract_id));
    return Array.from(s);
  }, [contractCandidates]);

  const { data: budgetAllocs } = useQuery({
    queryKey: ['request-invoice-links', 'budget-allocs', budgetIds.sort().join(',')],
    enabled: budgetIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_budget_allocations')
        .select('budget_id, invoice:invoices(id, code, status, invoice_date), budget:budgets(code)')
        .in('budget_id', budgetIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contractInvoices } = useQuery({
    queryKey: ['request-invoice-links', 'contract-invs', contractIds.sort().join(',')],
    enabled: contractIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, code, status, invoice_date, contract_id, billing_period_month, billing_period_year, contract:contracts(code)')
        .in('contract_id', contractIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const linksMap = useMemo(() => {
    const map = new Map<string, ResolvedInvoiceLink>();
    if (!requests) return map;

    // Index budget allocations
    const byBudget = new Map<string, Array<any>>();
    (budgetAllocs ?? []).forEach((a: any) => {
      if (!a.invoice) return;
      const arr = byBudget.get(a.budget_id) ?? [];
      arr.push(a);
      byBudget.set(a.budget_id, arr);
    });

    // Index contract invoices
    const byContract = new Map<string, Array<any>>();
    (contractInvoices ?? []).forEach((i: any) => {
      if (!i.contract_id) return;
      const arr = byContract.get(i.contract_id) ?? [];
      arr.push(i);
      byContract.set(i.contract_id, arr);
    });

    for (const r of requests) {
      // P1 — direct
      if (r.billed_invoice_id) {
        map.set(r.id, {
          invoiceId: r.billed_invoice_id,
          code: r.invoice?.code ?? null,
          status: r.invoice?.status ?? null,
          via: 'direct',
        });
        continue;
      }

      // P2 — via budget
      if (r.budget_id) {
        const allocs = byBudget.get(r.budget_id) ?? [];
        if (allocs.length > 0) {
          const sorted = [...allocs].sort((a, b) => {
            const da = a.invoice?.invoice_date ?? '';
            const db = b.invoice?.invoice_date ?? '';
            return db.localeCompare(da);
          });
          const pick = sorted[0];
          map.set(r.id, {
            invoiceId: pick.invoice.id,
            code: pick.invoice.code ?? null,
            status: pick.invoice.status ?? null,
            via: 'budget',
            budgetCode: pick.budget?.code ?? null,
            extraCount: allocs.length > 1 ? allocs.length - 1 : undefined,
          });
          continue;
        }
      }

      // P3 — via contract (match billing period to work period)
      if (r.contract_id) {
        const invs = byContract.get(r.contract_id) ?? [];
        const matches = invs.filter(
          (i: any) =>
            r.work_month != null &&
            r.work_year != null &&
            i.billing_period_month === r.work_month &&
            i.billing_period_year === r.work_year
        );
        if (matches.length === 1) {
          const pick = matches[0];
          map.set(r.id, {
            invoiceId: pick.id,
            code: pick.code ?? null,
            status: pick.status ?? null,
            via: 'contract',
            contractCode: pick.contract?.code ?? null,
          });
          continue;
        }
      }
    }
    return map;
  }, [requests, budgetAllocs, contractInvoices]);

  return linksMap;
};
