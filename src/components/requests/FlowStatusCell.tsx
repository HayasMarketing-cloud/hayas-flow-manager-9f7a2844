import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Wallet, FileText, Send, CheckCircle, Clock, AlertCircle, ExternalLink, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { InvoiceLinkVia } from '@/hooks/useRequestInvoiceLinks';

interface FlowStatusCellProps {
  type: 'invoice' | 'liquidation';
  linkedId: string | null | undefined;
  linkedCode?: string | null;
  linkedStatus?: string | null;
  linkVia?: InvoiceLinkVia;
  budgetCode?: string | null;
  contractCode?: string | null;
  extraCount?: number;
}

const getInvoiceConfig = (status: string | null | undefined) => {
  // Aligned with src/lib/invoice-utils.ts — only "Cobrada" vs "Pendiente de cobro"
  if (status === 'paid') {
    return { color: 'bg-green-500', icon: CheckCircle, label: 'Cobrada' };
  }
  if (status === 'draft') {
    return { color: 'bg-blue-500', icon: FileText, label: 'Borrador' };
  }
  if (status === 'overdue') {
    return { color: 'bg-red-500', icon: Clock, label: 'Vencida' };
  }
  if (status === 'cancelled') {
    return { color: 'bg-gray-500', icon: AlertCircle, label: 'Anulada' };
  }
  // sent / partial / anything else — pending payment
  return { color: 'bg-amber-500', icon: Send, label: 'Pendiente de cobro' };
};

const getLiquidationConfig = (status: string | null | undefined) => {
  switch (status) {
    case 'draft':
      return { color: 'bg-blue-500', icon: FileText, label: 'Borrador' };
    case 'sent':
      return { color: 'bg-orange-500', icon: Send, label: 'Enviada' };
    case 'signed':
      return { color: 'bg-purple-500', icon: CheckCircle, label: 'Firmada' };
    case 'paid':
      return { color: 'bg-green-500', icon: CheckCircle, label: 'Pagada' };
    default:
      return { color: 'bg-blue-500', icon: FileText, label: 'En proceso' };
  }
};

export const FlowStatusCell = ({
  type,
  linkedId,
  linkedCode,
  linkedStatus,
  linkVia = 'direct',
  budgetCode,
  contractCode,
  extraCount,
}: FlowStatusCellProps) => {
  const navigate = useNavigate();

  if (!linkedId) {
    if (type === 'invoice') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" />
                <span className="text-[11px] font-medium">Sin factura</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Este request aún no está facturado al cliente.</p>
              <p className="text-xs text-muted-foreground">Requisito antes de liquidar.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
          <Wallet className="h-3 w-3" />
        </div>
        <span className="text-xs">---</span>
      </div>
    );
  }

  const config = type === 'invoice' ? getInvoiceConfig(linkedStatus) : getLiquidationConfig(linkedStatus);
  const StatusIcon = config.icon;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (type === 'invoice') {
      navigate(`/facturas?highlight=${linkedId}`);
    } else {
      navigate(`/liquidaciones/${linkedId}`);
    }
  };

  const isIndirect = type === 'invoice' && linkVia !== 'direct';
  const viaLabel = isIndirect
    ? linkVia === 'budget'
      ? `Factura vinculada vía presupuesto${budgetCode ? ` ${budgetCode}` : ''}`
      : `Factura vinculada vía contrato${contractCode ? ` ${contractCode}` : ''}`
    : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            className="group inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-transparent hover:border-border hover:bg-muted/50 transition-colors"
          >
            <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-primary-foreground', config.color)}>
              <StatusIcon className="h-3 w-3" />
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="inline-flex items-center gap-1 text-xs font-mono font-medium text-primary group-hover:underline">
                {linkedCode || 'Sin código'}
                {isIndirect && <Link2 className="h-3 w-3 text-muted-foreground" />}
              </span>
              <span className="text-[10px] text-muted-foreground">{config.label}</span>
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">
            {type === 'invoice' ? 'Factura' : 'Liquidación'}: {linkedCode}
          </p>
          <p className="text-xs text-muted-foreground">{config.label}</p>
          {viaLabel && <p className="text-xs text-muted-foreground mt-1">{viaLabel}</p>}
          {extraCount ? (
            <p className="text-xs text-muted-foreground">
              +{extraCount} factura{extraCount === 1 ? '' : 's'} más asociada{extraCount === 1 ? '' : 's'} al mismo presupuesto
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground mt-1">
            Click para {type === 'invoice' ? 'ver en listado de facturas' : 'abrir liquidación'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
