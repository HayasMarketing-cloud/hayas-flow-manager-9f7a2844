import { Database } from '@/integrations/supabase/types';

type RequestStatus = Database['public']['Enums']['request_status'];

export interface RequestFlowStatus {
  hasInvoice: boolean;
  invoiceId: string | null;
  invoiceCode: string | null;
  invoiceStatus: string | null;
  hasLiquidation: boolean;
  liquidationId: string | null;
  liquidationCode: string | null;
  liquidationStatus: string | null;
  canGenerateInvoice: boolean;
  canAddToLiquidation: boolean;
  flowComplete: boolean;
  flowStage: 'pending' | 'invoiced' | 'liquidated' | 'completed';
}

export const getRequestFlowStatus = (request: any): RequestFlowStatus => {
  // Verificar si tiene factura
  const hasInvoice = request.billed_invoice_id !== null;
  const invoiceId = request.billed_invoice_id;
  
  // Verificar si tiene liquidación
  const hasLiquidation = request.liquidation_id !== null;
  const liquidationId = request.liquidation_id;

  // Determinar si puede generar factura
  const canGenerateInvoice = 
    request.status === 'completed' && 
    !hasInvoice;

  // Determinar si puede agregarse a liquidación
  const canAddToLiquidation = 
    hasInvoice && 
    !hasLiquidation && 
    request.specialist_id !== null;

  // Determinar etapa del flujo
  let flowStage: RequestFlowStatus['flowStage'] = 'pending';
  if (hasLiquidation) {
    flowStage = 'liquidated';
  } else if (hasInvoice) {
    flowStage = 'invoiced';
  }

  const flowComplete = hasInvoice && hasLiquidation;

  return {
    hasInvoice,
    invoiceId,
    invoiceCode: null, // Se llenará desde la query
    invoiceStatus: null,
    hasLiquidation,
    liquidationId,
    liquidationCode: null, // Se llenará desde la query
    liquidationStatus: null,
    canGenerateInvoice,
    canAddToLiquidation,
    flowComplete,
    flowStage,
  };
};

export const getFlowStageLabel = (stage: RequestFlowStatus['flowStage']): string => {
  const labels: Record<RequestFlowStatus['flowStage'], string> = {
    pending: 'Pendiente facturar',
    invoiced: 'Facturado',
    liquidated: 'En liquidación',
    completed: 'Completo',
  };
  return labels[stage];
};

export const getFlowStageColor = (stage: RequestFlowStatus['flowStage']): string => {
  const colors: Record<RequestFlowStatus['flowStage'], string> = {
    pending: 'bg-yellow-500 text-white',
    invoiced: 'bg-blue-500 text-white',
    liquidated: 'bg-purple-500 text-white',
    completed: 'bg-green-500 text-white',
  };
  return colors[stage];
};

export const canRequestBeInvoiced = (request: any): boolean => {
  return (
    request.status === 'completed' &&
    request.billed_invoice_id === null
  );
};

export const canRequestBeLiquidated = (request: any): boolean => {
  return (
    request.billed_invoice_id !== null &&
    request.liquidation_id === null &&
    request.specialist_id !== null
  );
};

export interface FlowStatistics {
  total: number;
  pending: number;
  invoiced: number;
  liquidated: number;
  completed: number;
  pendingValue: number;
  invoicedValue: number;
  liquidatedValue: number;
}

export const calculateFlowStatistics = (requests: any[]): FlowStatistics => {
  const stats: FlowStatistics = {
    total: requests.length,
    pending: 0,
    invoiced: 0,
    liquidated: 0,
    completed: 0,
    pendingValue: 0,
    invoicedValue: 0,
    liquidatedValue: 0,
  };

  requests.forEach((request) => {
    const flow = getRequestFlowStatus(request);
    
    switch (flow.flowStage) {
      case 'pending':
        stats.pending++;
        stats.pendingValue += request.total || 0;
        break;
      case 'invoiced':
        stats.invoiced++;
        stats.invoicedValue += request.total || 0;
        break;
      case 'liquidated':
        stats.liquidated++;
        stats.liquidatedValue += request.total || 0;
        break;
      case 'completed':
        stats.completed++;
        break;
    }
  });

  return stats;
};
