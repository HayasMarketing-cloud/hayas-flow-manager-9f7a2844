import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TaskFilters {
  clientId: string | null;
  specialistId: string | null;
  contractId: string | null;
  budgetId: string | null;
  monthYear: string | null; // formato "2025-01"
  onlyMyTasks: boolean;
}

export const useTaskFilters = () => {
  const [filters, setFilters] = useState<TaskFilters>({
    clientId: null,
    specialistId: null,
    contractId: null,
    budgetId: null,
    monthYear: null,
    onlyMyTasks: false,
  });

  // Fetch clients for filter dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ['filter-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch specialists for filter dropdown
  const { data: specialists = [] } = useQuery({
    queryKey: ['filter-specialists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch contracts for filter dropdown
  const { data: contracts = [] } = useQuery({
    queryKey: ['filter-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, title, code')
        .eq('status', 'active')
        .order('title');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch budgets for filter dropdown
  const { data: budgets = [] } = useQuery({
    queryKey: ['filter-budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('id, title, code')
        .in('status', ['approved', 'sent'])
        .order('title');
      if (error) throw error;
      return data || [];
    },
  });

  // Generate month options (last 12 months + next 6 months)
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    
    for (let i = -12; i <= 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    
    return options;
  }, []);

  const updateFilter = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      clientId: null,
      specialistId: null,
      contractId: null,
      budgetId: null,
      monthYear: null,
      onlyMyTasks: false,
    });
  };

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(v => v !== null && v !== false);
  }, [filters]);

  return {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    clients,
    specialists,
    contracts,
    budgets,
    monthOptions,
  };
};
