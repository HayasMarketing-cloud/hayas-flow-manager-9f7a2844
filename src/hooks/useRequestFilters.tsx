import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface RequestFilters {
  searchTerm: string;
  status: string | null;
  clientId: string | null;
  specialistId: string | null;
  budgetId: string | null;
}

export const useRequestFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [filters, setFilters] = useState<RequestFilters>(() => ({
    searchTerm: '',
    status: null,
    clientId: null,
    specialistId: null,
    budgetId: searchParams.get('budget_id'),
  }));

  // Sync budgetId from URL on mount
  useEffect(() => {
    const budgetIdFromUrl = searchParams.get('budget_id');
    if (budgetIdFromUrl && budgetIdFromUrl !== filters.budgetId) {
      setFilters((prev) => ({ ...prev, budgetId: budgetIdFromUrl }));
    }
  }, [searchParams]);

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
    
    // Update URL params for budgetId
    if (key === 'budgetId') {
      if (value) {
        searchParams.set('budget_id', value as string);
      } else {
        searchParams.delete('budget_id');
      }
      setSearchParams(searchParams, { replace: true });
    }
  };

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      status: null,
      clientId: null,
      specialistId: null,
      budgetId: null,
    });
    searchParams.delete('budget_id');
    setSearchParams(searchParams, { replace: true });
  };

  return {
    filters,
    updateFilter,
    resetFilters,
  };
};
