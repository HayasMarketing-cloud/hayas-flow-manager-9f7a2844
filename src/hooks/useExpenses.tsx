import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Expense {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  periodicity: string;
  monthly_cost: number;
  renewal_month: string | null;
  account_email: string | null;
  website_url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseRecord {
  id: string;
  expense_id: string;
  period_year: number;
  period_month: number;
  status: string;
  invoice_url: string | null;
  amount: number | null;
  notes: string | null;
  uploaded_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useExpenses() {
  const queryClient = useQueryClient();

  const expensesQuery = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Expense[];
    },
  });

  const createExpense = useMutation({
    mutationFn: async (expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('expenses').insert(expense).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Gasto creado correctamente');
    },
    onError: (e: any) => toast.error('Error al crear gasto: ' + e.message),
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Expense> & { id: string }) => {
      const { error } = await supabase.from('expenses').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Gasto actualizado');
    },
    onError: (e: any) => toast.error('Error al actualizar: ' + e.message),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Gasto eliminado');
    },
    onError: (e: any) => toast.error('Error al eliminar: ' + e.message),
  });

  return { ...expensesQuery, createExpense, updateExpense, deleteExpense };
}

export function useExpenseRecords(periodYear?: number, periodMonth?: number) {
  const queryClient = useQueryClient();

  const recordsQuery = useQuery({
    queryKey: ['expense-records', periodYear, periodMonth],
    queryFn: async () => {
      let query = supabase.from('expense_records').select('*');
      if (periodYear) query = query.eq('period_year', periodYear);
      if (periodMonth) query = query.eq('period_month', periodMonth);
      const { data, error } = await query.order('period_month');
      if (error) throw error;
      return data as ExpenseRecord[];
    },
  });

  const upsertRecord = useMutation({
    mutationFn: async (record: Omit<ExpenseRecord, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('expense_records')
        .upsert(record, { onConflict: 'expense_id,period_year,period_month' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-records'] });
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });

  return { ...recordsQuery, upsertRecord };
}
