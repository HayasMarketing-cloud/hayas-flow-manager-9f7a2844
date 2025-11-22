import { useState } from 'react';

export interface ContractFilters {
  searchTerm: string;
  status: string | null;
  clientId: string | null;
}

export const useContractFilters = () => {
  const [filters, setFilters] = useState<ContractFilters>({
    searchTerm: '',
    status: null,
    clientId: null,
  });

  const updateFilter = <K extends keyof ContractFilters>(
    key: K,
    value: ContractFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      status: null,
      clientId: null,
    });
  };

  return {
    filters,
    updateFilter,
    resetFilters,
  };
};
