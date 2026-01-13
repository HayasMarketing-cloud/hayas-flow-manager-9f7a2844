import { useState } from 'react';

export interface RequestFilters {
  searchTerm: string;
  status: string | null;
  clientId: string | null;
  specialistId: string | null;
  budgetId: string | null;
}

export const useRequestFilters = () => {
  const [filters, setFilters] = useState<RequestFilters>({
    searchTerm: '',
    status: null,
    clientId: null,
    specialistId: null,
    budgetId: null,
  });

  const updateFilter = <K extends keyof RequestFilters>(
    key: K,
    value: RequestFilters[K]
  ) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      // Reset budget filter when client changes
      if (key === 'clientId') {
        newFilters.budgetId = null;
      }
      return newFilters;
    });
  };

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      status: null,
      clientId: null,
      specialistId: null,
      budgetId: null,
    });
  };

  return {
    filters,
    updateFilter,
    resetFilters,
  };
};
