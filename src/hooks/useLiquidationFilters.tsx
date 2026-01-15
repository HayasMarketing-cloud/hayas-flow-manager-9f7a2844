import { useState } from 'react';
import { Database } from '@/integrations/supabase/types';

type LiquidationStatus = Database['public']['Enums']['liquidation_status'];

export type PeriodType = 'current_month' | 'last_month' | 'current_year' | 'last_year' | 'all' | 'custom';

export interface LiquidationFilters {
  searchTerm: string;
  status: LiquidationStatus | null;
  specialistId: string | null;
  periodType: PeriodType;
  year: number | null;
  month: number | null;
}

const now = new Date();

const getDefaultFilters = (): LiquidationFilters => ({
  searchTerm: '',
  status: null,
  specialistId: null,
  periodType: 'all',
  year: null,
  month: null,
});

export const useLiquidationFilters = () => {
  const [filters, setFilters] = useState<LiquidationFilters>(getDefaultFilters());

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

      return newFilters;
    });
  };

  const resetFilters = () => {
    setFilters(getDefaultFilters());
  };

  return {
    filters,
    updateFilter,
    resetFilters,
  };
};
