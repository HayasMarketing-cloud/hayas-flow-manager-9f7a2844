import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Receipt, Wallet, FileText, Send, CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FlowStatusCellProps {
  type: 'invoice' | 'liquidation';
  linkedId: string | null | undefined;
  linkedCode?: string | null;
  linkedStatus?: string | null;
}

const getStatusConfig = (type: 'invoice' | 'liquidation', status: string | null | undefined) => {
  if (type === 'invoice') {
    switch (status) {
      case 'draft':
        return { color: 'bg-blue-500', icon: FileText, label: 'Borrador' };
      case 'sent':
        return { color: 'bg-orange-500', icon: Send, label: 'Enviada' };
      case 'paid':
        return { color: 'bg-green-500', icon: CheckCircle, label: 'Cobrada' };
      case 'partial':
        return { color: 'bg-yellow-500', icon: Clock, label: 'Cobro parcial' };
      case 'overdue':
        return { color: 'bg-red-500', icon: Clock, label: 'Vencida' };
      default:
        return { color: 'bg-blue-500', icon: FileText, label: 'En proceso' };
    }
  } else {
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
  }
};

export const FlowStatusCell = ({ type, linkedId, linkedCode, linkedStatus }: FlowStatusCellProps) => {
  const navigate = useNavigate();

  if (!linkedId) {
    // Empty state — highlight missing invoice in amber to signal it blocks liquidation
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

  const config = getStatusConfig(type, linkedStatus);
  const StatusIcon = config.icon;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (type === 'invoice') {
      // Deep-link to invoices list with the invoice pre-selected via query param
      navigate(`/facturas?highlight=${linkedId}`);
    } else {
      navigate(`/liquidaciones/${linkedId}`);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            className="group inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-transparent hover:border-border hover:bg-muted/50 transition-colors"
          >
            <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-primary-foreground", config.color)}>
              <StatusIcon className="h-3 w-3" />
            </div>
            <span className="text-xs font-mono font-medium text-primary group-hover:underline">
              {linkedCode || 'Sin código'}
            </span>
            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">
            {type === 'invoice' ? 'Factura' : 'Liquidación'}: {linkedCode}
          </p>
          <p className="text-xs text-muted-foreground">{config.label}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click para {type === 'invoice' ? 'ver en listado de facturas' : 'abrir liquidación'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
