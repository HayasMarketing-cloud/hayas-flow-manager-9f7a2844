import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database } from '@/integrations/supabase/types';

type LiquidationStatus = Database['public']['Enums']['liquidation_status'];

export type PeriodType = 'current_month' | 'last_month' | 'current_year' | 'last_year' | 'all' | 'custom';

export interface LiquidationFilters {
  searchTerm: string;
  status: LiquidationStatus | 'not_paid' | null;
  specialistId: string | null;
  periodType: PeriodType;
  year: number | null;
  month: number | null;
}

const getDefaultFilters = (): LiquidationFilters => ({
  searchTerm: '',
  status: null,
  specialistId: null,
  periodType: 'all',
  year: null,
  month: null,
});

const validStatuses: LiquidationStatus[] = ['draft', 'validated', 'sent', 'accepted', 'pending_payment', 'paid'];
const validPeriodTypes: PeriodType[] = ['current_month', 'last_month', 'current_year', 'last_year', 'all', 'custom'];

export const useLiquidationFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize filters from URL params
  const getFiltersFromURL = useCallback((): LiquidationFilters => {
    const defaults = getDefaultFilters();
    
    const status = searchParams.get('status');
    const specialistId = searchParams.get('specialist');
    const searchTerm = searchParams.get('search') || '';
    const periodType = searchParams.get('period') as PeriodType | null;
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    return {
      searchTerm,
      status: status && validStatuses.includes(status as LiquidationStatus) 
        ? status as LiquidationStatus 
        : defaults.status,
      specialistId: specialistId || defaults.specialistId,
      periodType: periodType && validPeriodTypes.includes(periodType) 
        ? periodType 
        : defaults.periodType,
      year: year ? parseInt(year, 10) : defaults.year,
      month: month ? parseInt(month, 10) : defaults.month,
    };
  }, [searchParams]);

  const [filters, setFilters] = useState<LiquidationFilters>(getFiltersFromURL);

  // Sync filters with URL on mount and URL changes
  useEffect(() => {
    setFilters(getFiltersFromURL());
  }, [getFiltersFromURL]);

  // Update URL when filters change
  const syncToURL = useCallback((newFilters: LiquidationFilters) => {
    const params = new URLSearchParams();
    
    if (newFilters.searchTerm) params.set('search', newFilters.searchTerm);
    if (newFilters.status) params.set('status', newFilters.status);
    if (newFilters.specialistId) params.set('specialist', newFilters.specialistId);
    if (newFilters.periodType && newFilters.periodType !== 'all') params.set('period', newFilters.periodType);
    if (newFilters.year) params.set('year', newFilters.year.toString());
    if (newFilters.month) params.set('month', newFilters.month.toString());

    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  const updateFilter = <K extends keyof LiquidationFilters>(
    key: K,
    value: LiquidationFilters[K]
  ) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };

      // Auto-actualizar year/month según periodType
      if (key === 'periodType') {
        const periodType = value as PeriodType;
        const now = new Date();

        switch (periodType) {
          case 'current_month':
            newFilters.year = now.getFullYear();
            newFilters.month = now.getMonth() + 1;
            break;
          case 'last_month':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            newFilters.year = lastMonth.getFullYear();
            newFilters.month = lastMonth.getMonth() + 1;
            break;
          case 'current_year':
            newFilters.year = now.getFullYear();
            newFilters.month = null;
            break;
          case 'last_year':
            newFilters.year = now.getFullYear() - 1;
            newFilters.month = null;
            break;
          case 'all':
            newFilters.year = null;
            newFilters.month = null;
            break;
          // 'custom' mantiene los valores existentes
        }
      }

      syncToURL(newFilters);
      return newFilters;
    });
  };

  const resetFilters = () => {
    const defaultFilters = getDefaultFilters();
    setFilters(defaultFilters);
    setSearchParams({}, { replace: true });
  };

  return {
    filters,
    updateFilter,
    resetFilters,
  };
};
