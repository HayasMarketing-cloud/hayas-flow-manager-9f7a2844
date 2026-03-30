import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface RequestFilters {
  searchTerm: string;
  status: string | null;
  clientId: string | null;
  specialistId: string | null;
  budgetId: string | null;
  contractId: string | null;
  partnerReference: string | null;
  workMonth: number | null;
  workYear: number | null;
}

export const useRequestFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive filters directly from URL params — always in sync
  const filters = useMemo<RequestFilters>(() => ({
    searchTerm: searchParams.get('search') || '',
    status: searchParams.get('status'),
    clientId: searchParams.get('clientId'),
    specialistId: searchParams.get('specialistId'),
    budgetId: searchParams.get('budget_id'),
    contractId: searchParams.get('contractId'),
    year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : null,
    month: searchParams.get('month') ? parseInt(searchParams.get('month')!) : null,
    partnerReference: searchParams.get('partnerReference'),
    workMonth: searchParams.get('workMonth') ? parseInt(searchParams.get('workMonth')!) : null,
    workYear: searchParams.get('workYear') ? parseInt(searchParams.get('workYear')!) : null,
  }), [searchParams]);

  const buildParams = useCallback((newFilters: RequestFilters) => {
    const newParams = new URLSearchParams();
    if (newFilters.searchTerm) newParams.set('search', newFilters.searchTerm);
    if (newFilters.status) newParams.set('status', newFilters.status);
    if (newFilters.clientId) newParams.set('clientId', newFilters.clientId);
    if (newFilters.specialistId) newParams.set('specialistId', newFilters.specialistId);
    if (newFilters.budgetId) newParams.set('budget_id', newFilters.budgetId);
    if (newFilters.contractId) newParams.set('contractId', newFilters.contractId);
    if (newFilters.year) newParams.set('year', newFilters.year.toString());
    if (newFilters.month) newParams.set('month', newFilters.month.toString());
    if (newFilters.partnerReference) newParams.set('partnerReference', newFilters.partnerReference);
    if (newFilters.workMonth) newParams.set('workMonth', newFilters.workMonth.toString());
    if (newFilters.workYear) newParams.set('workYear', newFilters.workYear.toString());
    return newParams;
  }, []);

  const updateFilter = useCallback(<K extends keyof RequestFilters>(
    key: K,
    value: RequestFilters[K]
  ) => {
    const newFilters = { ...filters, [key]: value };
    // Reset budget and contract filters when client changes
    if (key === 'clientId') {
      newFilters.budgetId = null;
      newFilters.contractId = null;
    }
    if (key === 'year' && value === null) {
      newFilters.month = null;
    }
    if (key === 'workYear' && value === null) {
      newFilters.workMonth = null;
    }
    setSearchParams(buildParams(newFilters), { replace: true });
  }, [filters, setSearchParams, buildParams]);

  const resetFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return {
    filters,
    updateFilter,
    resetFilters,
  };
};
