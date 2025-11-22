import { useState } from 'react';

export interface BudgetFilters {
  searchTerm: string;
  status: string | null;
  clientId: string | null;
}

export const useBudgetFilters = () => {
  const [filters, setFilters] = useState<BudgetFilters>({
    searchTerm: '',
    status: null,
    clientId: null,
  });

  const updateFilter = <K extends keyof BudgetFilters>(
    key: K,
    value: BudgetFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      status: null,
      clientId: null,
    });
  };

  return {
    filters,
    updateFilter,
    resetFilters,
  };
};
