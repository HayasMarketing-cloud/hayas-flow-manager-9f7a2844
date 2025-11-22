import { Database } from '@/integrations/supabase/types';

type ContractStatus = Database['public']['Tables']['contracts']['Row']['status'];

export const getContractStatusColor = (status: ContractStatus): string => {
  const colors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    active: 'bg-green-500 text-white',
    suspended: 'bg-yellow-500 text-white',
    expired: 'bg-destructive text-destructive-foreground',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
};

export const getContractStatusLabel = (status: ContractStatus): string => {
  const labels: Record<string, string> = {
    draft: 'Borrador',
    active: 'Activo',
    suspended: 'Suspendido',
    expired: 'Expirado',
  };
  return labels[status] || status;
};

export const getBillingModeLabel = (mode: string): string => {
  const labels: Record<string, string> = {
    monthly: 'Mensual',
    per_service: 'Por Servicio',
    one_time: 'Único',
  };
  return labels[mode] || mode;
};

export const calculateServiceTotal = (quantity: number, unitPrice: number): number => {
  return quantity * unitPrice;
};

export const calculateContractTotal = (services: Array<{ total?: number; quantity: number; unit_price: number }>): number => {
  return services.reduce((sum, service) => {
    const total = service.total || (service.quantity * service.unit_price);
    return sum + total;
  }, 0);
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

export const isContractEditable = (status: ContractStatus): boolean => {
  return status === 'draft';
};

export const canActivateContract = (status: ContractStatus): boolean => {
  return status === 'draft';
};

export const canSuspendContract = (status: ContractStatus): boolean => {
  return status === 'active';
};

export const canResumeContract = (status: ContractStatus): boolean => {
  return status === 'suspended';
};

export const canGenerateRequests = (status: ContractStatus): boolean => {
  return status === 'active';
};
