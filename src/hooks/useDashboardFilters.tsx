import { useState, useEffect } from 'react';

export interface DashboardFilters {
  year: number;
  month: number | null;
  period: 'month' | 'year';
}

const STORAGE_KEY = 'dashboard-filters';

const getDefaultFilters = (): DashboardFilters => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    period: 'month',
  };
};

export const useDashboardFilters = () => {
  const [filters, setFilters] = useState<DashboardFilters>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : getDefaultFilters();
    } catch {
      return getDefaultFilters();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const updateFilters = (newFilters: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters(getDefaultFilters());
  };

  const getPreviousPeriod = () => {
    if (filters.period === 'month' && filters.month) {
      const prevMonth = filters.month === 1 ? 12 : filters.month - 1;
      const prevYear = filters.month === 1 ? filters.year - 1 : filters.year;
      return { year: prevYear, month: prevMonth };
    }
    return { year: filters.year - 1, month: null };
  };

  return {
    filters,
    updateFilters,
    resetFilters,
    getPreviousPeriod,
  };
};
