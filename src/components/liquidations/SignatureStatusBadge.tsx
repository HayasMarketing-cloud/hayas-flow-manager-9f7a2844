import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  HelpCircle
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SignatureStatusBadgeProps {
  signature?: {
    status: string;
    signed_at?: string;
    ip_address?: string;
    dispute_reason?: string;
    expires_at: string;
  } | null;
}

export const SignatureStatusBadge = ({ signature }: SignatureStatusBadgeProps) => {
  if (!signature) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <HelpCircle className="h-3 w-3 mr-1" />
        Sin enviar
      </Badge>
    );
  }

  const isExpired = new Date(signature.expires_at) < new Date();

  if (signature.status === 'pending') {
    if (isExpired) {
      return (
        <Badge variant="destructive" className="bg-orange-100 text-orange-700 border-orange-300">
          <Clock className="h-3 w-3 mr-1" />
          Enlace expirado
        </Badge>
      );
    }
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            Pendiente de firma
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Expira: {new Date(signature.expires_at).toLocaleDateString('es-ES')}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (signature.status === 'accepted') {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge className="bg-green-100 text-green-700 border-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Firmada
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p><strong>Firmada:</strong> {new Date(signature.signed_at!).toLocaleString('es-ES')}</p>
            {signature.ip_address && <p><strong>IP:</strong> {signature.ip_address}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (signature.status === 'disputed') {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Disputada
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p><strong>Disputada:</strong> {new Date(signature.signed_at!).toLocaleString('es-ES')}</p>
            {signature.dispute_reason && <p><strong>Motivo:</strong> {signature.dispute_reason}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
};
