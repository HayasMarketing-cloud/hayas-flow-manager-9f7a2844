import { useState } from 'react';
import { Database } from '@/integrations/supabase/types';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

export type PeriodType = 'this_month' | 'last_month' | 'this_year' | 'custom';

export interface InvoiceFilters {
  searchTerm: string;
  status: InvoiceStatus | null;
  clientId: string | null;
  periodType: PeriodType;
  startDate: string | null;
  endDate: string | null;
}

const getDefaultFilters = (): InvoiceFilters => {
  return {
    searchTerm: '',
    status: null,
    clientId: null,
    periodType: 'this_month',
    startDate: null,
    endDate: null,
  };
};

export const useInvoiceFilters = () => {
  const [filters, setFilters] = useState<InvoiceFilters>(getDefaultFilters());

  const updateFilter = <K extends keyof InvoiceFilters>(
    key: K,
    value: InvoiceFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(getDefaultFilters());
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

  return {
    filters,
    updateFilter,
    resetFilters,
    getDateRange,
  };
};
