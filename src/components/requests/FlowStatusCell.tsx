import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Receipt, Wallet, FileText, Send, CheckCircle, Clock } from 'lucide-react';
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
        return { color: 'bg-green-500', icon: CheckCircle, label: 'Pagada' };
      case 'partial':
        return { color: 'bg-yellow-500', icon: Clock, label: 'Pago parcial' };
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
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
          {type === 'invoice' ? (
            <Receipt className="h-3 w-3" />
          ) : (
            <Wallet className="h-3 w-3" />
          )}
        </div>
        <span className="text-xs">---</span>
      </div>
    );
  }

  const config = getStatusConfig(type, linkedStatus);
  const StatusIcon = config.icon;

  const handleClick = () => {
    if (type === 'invoice') {
      navigate(`/facturas`);
    } else {
      navigate(`/liquidaciones`);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
            onClick={handleClick}
          >
            <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-white", config.color)}>
              <StatusIcon className="h-3 w-3" />
            </div>
            <span className="text-xs font-mono text-primary hover:underline">{linkedCode || 'Sin código'}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{type === 'invoice' ? 'Factura' : 'Liquidación'}: {linkedCode}</p>
          <p className="text-xs text-muted-foreground">{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};