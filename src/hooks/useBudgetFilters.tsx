import { useState } from 'react';

export interface BudgetFilters {
  searchTerm: string;
  status: string | null;
  clientId: string | null;
  invoiceMonth: number | null;
  invoiceYear: number | null;
}

export const useBudgetFilters = () => {
  const [filters, setFilters] = useState<BudgetFilters>({
    searchTerm: '',
    status: null,
    clientId: null,
    invoiceMonth: null,
    invoiceYear: null,
  });

  const updateFilter = <K extends keyof BudgetFilters>(
    key: K,
    value: BudgetFilters[K]
  ) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'invoiceYear' && value === null) {
        next.invoiceMonth = null;
      }
      return next;
    });
  };

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      status: null,
      clientId: null,
      invoiceMonth: null,
      invoiceYear: null,
    });
  };

  return {
    filters,
    updateFilter,
    resetFilters,
  };
};
