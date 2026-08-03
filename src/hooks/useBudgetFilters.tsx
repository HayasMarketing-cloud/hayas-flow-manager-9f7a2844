import { useState } from 'react';

export type BudgetInvoicedFilter = 'invoiced' | 'partial' | 'not_invoiced' | null;

export interface BudgetFilters {
  searchTerm: string;
  status: string | null;
  clientId: string | null;
  invoiceMonth: number | null;
  invoiceYear: number | null;
  invoicedStatus: BudgetInvoicedFilter;
}

export const useBudgetFilters = () => {
  const [filters, setFilters] = useState<BudgetFilters>({
    searchTerm: '',
    status: null,
    clientId: null,
    invoiceMonth: null,
    invoiceYear: null,
    invoicedStatus: null,
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
      invoicedStatus: null,
    });
  };

  return {
    filters,
    updateFilter,
    resetFilters,
  };
};
