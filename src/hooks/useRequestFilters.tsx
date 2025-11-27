import { useState } from 'react';

export interface RequestFilters {
  searchTerm: string;
  status: string | null;
  clientId: string | null;
  specialistId: string | null;
}

export const useRequestFilters = () => {
  const [filters, setFilters] = useState<RequestFilters>({
    searchTerm: '',
    status: null,
    clientId: null,
    specialistId: null,
  });

  const updateFilter = <K extends keyof RequestFilters>(
    key: K,
    value: RequestFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      status: null,
      clientId: null,
      specialistId: null,
    });
  };

  return {
    filters,
    updateFilter,
    resetFilters,
  };
};
