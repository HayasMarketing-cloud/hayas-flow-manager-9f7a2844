import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface RequestFilters {
  searchTerm: string;
  status: string | null;
  clientId: string | null;
  specialistId: string | null;
  budgetId: string | null;
  year: number | null;
  month: number | null;
}

export const useRequestFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize filters from URL params
  const [filters, setFilters] = useState<RequestFilters>(() => ({
    searchTerm: searchParams.get('search') || '',
    status: searchParams.get('status'),
    clientId: searchParams.get('clientId'),
    specialistId: searchParams.get('specialistId'),
    budgetId: searchParams.get('budget_id'),
    year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : null,
    month: searchParams.get('month') ? parseInt(searchParams.get('month')!) : null,
  }));

  // Sync filters TO URL whenever they change
  const syncToUrl = useCallback((newFilters: RequestFilters) => {
    const newParams = new URLSearchParams();
    
    if (newFilters.searchTerm) newParams.set('search', newFilters.searchTerm);
    if (newFilters.status) newParams.set('status', newFilters.status);
    if (newFilters.clientId) newParams.set('clientId', newFilters.clientId);
    if (newFilters.specialistId) newParams.set('specialistId', newFilters.specialistId);
    if (newFilters.budgetId) newParams.set('budget_id', newFilters.budgetId);
    if (newFilters.year) newParams.set('year', newFilters.year.toString());
    if (newFilters.month) newParams.set('month', newFilters.month.toString());
    
    setSearchParams(newParams, { replace: true });
  }, [setSearchParams]);

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
      // Reset month if year is cleared
      if (key === 'year' && value === null) {
        newFilters.month = null;
      }
      
      // Sync to URL
      syncToUrl(newFilters);
      
      return newFilters;
    });
  };

  const resetFilters = () => {
    const emptyFilters: RequestFilters = {
      searchTerm: '',
      status: null,
      clientId: null,
      specialistId: null,
      budgetId: null,
      year: null,
      month: null,
    };
    setFilters(emptyFilters);
    setSearchParams({}, { replace: true });
  };

  return {
    filters,
    updateFilter,
    resetFilters,
  };
};
