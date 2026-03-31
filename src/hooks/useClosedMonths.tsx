import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClosedMonth {
  id: string;
  year: number;
  month: number;
  closed_by: string;
  closed_at: string;
  notes: string | null;
}

export const useClosedMonths = () => {
  return useQuery({
    queryKey: ['closed-months'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closed_months' as any)
        .select('*')
        .order('year', { ascending: true })
        .order('month', { ascending: true });
      if (error) throw error;
      return (data || []) as ClosedMonth[];
    },
  });
};

export const useIsMonthClosed = (year: number, month: number) => {
  const { data: closedMonths } = useClosedMonths();
  return closedMonths?.some(cm => cm.year === year && cm.month === month) ?? false;
};

/**
 * Returns the oldest unclosed month, starting from Jan of the previous year.
 * Falls back to the current month if all months are closed.
 */
export const getDefaultMonth = (closedMonths: ClosedMonth[] | undefined): { year: number; month: number } => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (!closedMonths?.length) {
    // No closed months → default to previous month (the one being worked on)
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    return { year: prevYear, month: prevMonth };
  }

  const closedSet = new Set(closedMonths.map(cm => `${cm.year}-${cm.month}`));

  // Search from Jan of previous year up to current month
  for (let y = currentYear - 1; y <= currentYear; y++) {
    const startM = 1;
    const endM = y === currentYear ? currentMonth : 12;
    for (let m = startM; m <= endM; m++) {
      if (!closedSet.has(`${y}-${m}`)) {
        return { year: y, month: m };
      }
    }
  }

  // All closed, show current month
  return { year: currentYear, month: currentMonth };
};

export interface MonthValidation {
  canClose: boolean;
  issues: string[];
}

export const useValidateMonthClosure = (year: number, month: number) => {
  return useQuery({
    queryKey: ['validate-month-closure', year, month],
    queryFn: async (): Promise<MonthValidation> => {
      const issues: string[] = [];
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      // Check unpaid invoices for this period
      const { data: unpaidInvoices } = await supabase
        .from('invoices')
        .select('id, code, status')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .neq('status', 'paid');

      if (unpaidInvoices?.length) {
        issues.push(`${unpaidInvoices.length} factura(s) sin cobrar: ${unpaidInvoices.slice(0, 3).map(i => i.code).join(', ')}${unpaidInvoices.length > 3 ? '...' : ''}`);
      }

      // Check unpaid liquidations
      const { data: unpaidLiqs } = await supabase
        .from('liquidations')
        .select('id, code, status')
        .eq('period_year', year)
        .eq('period_month', month)
        .neq('status', 'paid');

      if (unpaidLiqs?.length) {
        issues.push(`${unpaidLiqs.length} liquidación(es) sin pagar: ${unpaidLiqs.slice(0, 3).map(l => l.code).join(', ')}${unpaidLiqs.length > 3 ? '...' : ''}`);
      }

      return {
        canClose: issues.length === 0,
        issues,
      };
    },
  });
};

export const useCloseMonth = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ year, month, userId }: { year: number; month: number; userId: string }) => {
      const { error } = await supabase
        .from('closed_months' as any)
        .insert({ year, month, closed_by: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closed-months'] });
    },
  });
};

export const useReopenMonth = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) => {
      const { error } = await supabase
        .from('closed_months' as any)
        .delete()
        .eq('year', year)
        .eq('month', month);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closed-months'] });
    },
  });
};
