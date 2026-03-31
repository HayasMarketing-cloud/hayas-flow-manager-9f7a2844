import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type PeriodType = 'all' | 'this_month' | 'last_month' | 'this_year' | 'custom';

// Simplified status filter: 'paid' or 'pending' (all non-paid)
export type InvoiceStatusFilter = 'paid' | 'pending' | null;

// Special filter for dashboard links
export type SpecialFilter = 'overdue' | null;

export interface InvoiceFilters {
  searchTerm: string;
  status: InvoiceStatusFilter;
  clientIds: string[];
  periodType: PeriodType;
  startDate: string | null;
  endDate: string | null;
  specialFilter: SpecialFilter;
}

const getFiltersFromParams = (searchParams: URLSearchParams): InvoiceFilters => {
  const specialFilter = searchParams.get('filter') as SpecialFilter;
  const clientIdsParam = searchParams.get('clientIds');
  
  return {
    searchTerm: searchParams.get('search') || '',
    status: (searchParams.get('status') as InvoiceStatusFilter) || null,
    clientIds: clientIdsParam ? clientIdsParam.split(',').filter(Boolean) : [],
    periodType: (searchParams.get('period') as PeriodType) || 'all',
    startDate: searchParams.get('startDate') || null,
    endDate: searchParams.get('endDate') || null,
    specialFilter: specialFilter === 'overdue' ? 'overdue' : null,
  };
};

export const useInvoiceFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<InvoiceFilters>(() => getFiltersFromParams(searchParams));

  // Sync filters TO URL whenever they change
  const syncToUrl = useCallback((newFilters: InvoiceFilters) => {
    const newParams = new URLSearchParams();
    
    if (newFilters.searchTerm) newParams.set('search', newFilters.searchTerm);
    if (newFilters.status) newParams.set('status', newFilters.status);
    if (newFilters.clientId) newParams.set('clientId', newFilters.clientId);
    if (newFilters.periodType !== 'all') newParams.set('period', newFilters.periodType);
    if (newFilters.startDate) newParams.set('startDate', newFilters.startDate);
    if (newFilters.endDate) newParams.set('endDate', newFilters.endDate);
    if (newFilters.specialFilter) newParams.set('filter', newFilters.specialFilter);
    
    setSearchParams(newParams, { replace: true });
  }, [setSearchParams]);

  const updateFilter = <K extends keyof InvoiceFilters>(
    key: K,
    value: InvoiceFilters[K]
  ) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      
      // Clear special filter when user changes other filters
      if (key !== 'specialFilter' && prev.specialFilter) {
        newFilters.specialFilter = null;
      }
      
      syncToUrl(newFilters);
      return newFilters;
    });
  };

  const resetFilters = () => {
    const emptyFilters: InvoiceFilters = {
      searchTerm: '',
      status: null,
      clientId: null,
      periodType: 'all',
      startDate: null,
      endDate: null,
      specialFilter: null,
    };
    setFilters(emptyFilters);
    setSearchParams({}, { replace: true });
  };

  const getDateRange = (): { startDate: string; endDate: string } => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (filters.periodType) {
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'custom':
        return {
          startDate: filters.startDate || '',
          endDate: filters.endDate || '',
        };
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  };

  // Check if overdue filter is active
  const isOverdueFilter = filters.specialFilter === 'overdue';

  return {
    filters,
    updateFilter,
    resetFilters,
    getDateRange,
    isOverdueFilter,
  };
};
