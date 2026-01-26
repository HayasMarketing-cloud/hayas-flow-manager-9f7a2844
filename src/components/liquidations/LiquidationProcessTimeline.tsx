import { 
  FileText, 
  CheckCircle2, 
  Mail, 
  Clock, 
  AlertCircle, 
  AlertTriangle, 
  Wallet, 
  CircleCheck,
  RefreshCw,
  Receipt,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatExpectedPaymentDate } from '@/lib/liquidation-utils';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';

type LiquidationStatus = Database['public']['Enums']['liquidation_status'];

interface TimelineStep {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending' | 'error' | 'warning';
  date?: string;
  description?: string;
  details?: string[];
  actions?: React.ReactNode;
}

interface SignatureData {
  status: string;
  expires_at: string;
  signed_at?: string;
  ip_address?: string;
  dispute_reason?: string;
  specialist_comments?: string;
}

interface LiquidationData {
  status: LiquidationStatus;
  code: string;
  created_at: string;
  sent_at?: string | null;
  paid_at?: string | null;
  total_amount: number;
  calculated_total?: number;
  period_year: number;
  period_month: number;
  liquidation_items?: any[];
  specialist?: { 
    email?: string;
    name?: string;
  } | null;
  specialist_invoice_url?: string | null;
}

interface LiquidationProcessTimelineProps {
  liquidation: LiquidationData;
  signature?: SignatureData | null;
  onResendEmail?: () => void;
  isSending?: boolean;
}

const statusOrder: LiquidationStatus[] = ['draft', 'validated', 'sent', 'accepted', 'invoice_received', 'disputed', 'pending_payment', 'paid'];

const getStatusIndex = (status: LiquidationStatus): number => {
  return statusOrder.indexOf(status);
};

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (dateString?: string | null): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildTimelineSteps = (
  liquidation: LiquidationData,
  signature: SignatureData | null | undefined,
  onResendEmail?: () => void,
  isSending?: boolean
): TimelineStep[] => {
  const steps: TimelineStep[] = [];
  const currentIndex = getStatusIndex(liquidation.status);
  const total = liquidation.calculated_total ?? liquidation.total_amount;
  const itemsCount = liquidation.liquidation_items?.length || 0;

  // 1. Borrador creado
  steps.push({
    id: 'draft',
    label: 'Borrador creado',
    status: 'completed',
    date: formatDate(liquidation.created_at),
    description: `Liquidación ${liquidation.code} creada`,
  });

  // 2. Validada
  steps.push({
    id: 'validated',
    label: 'Validada',
    status: currentIndex >= 1 ? 'completed' : (currentIndex === 0 ? 'current' : 'pending'),
    description: `${itemsCount} trabajo${itemsCount !== 1 ? 's' : ''} incluido${itemsCount !== 1 ? 's' : ''} por ${formatCurrency(total)}`,
  });

  // 3. Enviada
  steps.push({
    id: 'sent',
    label: 'Enviada por email',
    status: currentIndex >= 2 ? 'completed' : (currentIndex === 1 ? 'current' : 'pending'),
    date: liquidation.sent_at ? formatDateTime(liquidation.sent_at) : undefined,
    description: liquidation.specialist?.email 
      ? `Destinatario: ${liquidation.specialist.email}` 
      : 'Sin email de especialista',
  });

  // 4. Estado de firma (solo si ya se envió)
  if (currentIndex >= 2) {
    if (signature) {
      const isExpired = new Date(signature.expires_at) < new Date();
      const daysUntilExpiry = Math.ceil(
        (new Date(signature.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (signature.status === 'pending') {
        const details: string[] = [];
        if (!isExpired) {
          details.push(`Válido hasta: ${formatDate(signature.expires_at)}`);
          if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
            details.push(`⚠️ Expira en ${daysUntilExpiry} día${daysUntilExpiry !== 1 ? 's' : ''}`);
          }
        }

        steps.push({
          id: 'signature_pending',
          label: isExpired ? 'Enlace de firma expirado' : 'Pendiente de firma',
          status: isExpired ? 'error' : 'warning',
          description: isExpired 
            ? 'El enlace ha expirado. Reenvía el email para generar uno nuevo.'
            : 'El especialista aún no ha respondido',
          details: details.length > 0 ? details : undefined,
          actions: onResendEmail ? (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onResendEmail}
              disabled={isSending}
              className="mt-2"
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", isSending && "animate-spin")} />
              {isSending ? 'Reenviando...' : 'Reenviar email'}
            </Button>
          ) : undefined,
        });
      } else if (signature.status === 'accepted') {
        const details: string[] = [];
        if (signature.ip_address) {
          details.push(`IP: ${signature.ip_address}`);
        }
        if (signature.specialist_comments) {
          details.push(`Comentarios: ${signature.specialist_comments}`);
        }

        steps.push({
          id: 'signature_accepted',
          label: 'Firmada por el especialista',
          status: 'completed',
          date: formatDateTime(signature.signed_at),
          description: signature.specialist_comments || 'Aceptada sin comentarios',
          details: details.length > 0 ? details : undefined,
        });
      } else if (signature.status === 'disputed') {
        steps.push({
          id: 'signature_disputed',
          label: 'Disputada por el especialista',
          status: 'error',
          date: formatDateTime(signature.signed_at),
          description: signature.dispute_reason || 'Sin motivo especificado',
          details: signature.specialist_comments ? [`Comentarios: ${signature.specialist_comments}`] : undefined,
        });
      }
    } else {
      // Enviada pero sin registro de firma aún
      steps.push({
        id: 'signature_pending',
        label: 'Esperando respuesta',
        status: 'current',
        description: 'El especialista aún no ha abierto el enlace de firma',
      });
    }
  } else {
    // Aún no enviada
    steps.push({
      id: 'signature_pending',
      label: 'Pendiente de firma',
      status: 'pending',
      description: 'Se habilitará tras enviar la liquidación',
    });
  }

  // 5. Aceptada/Estado final
  if (signature?.status !== 'accepted' && signature?.status !== 'disputed') {
    steps.push({
      id: 'accepted',
      label: 'Aceptada',
      status: currentIndex >= 3 ? 'completed' : 'pending',
    });
  }

  // 6. Factura del especialista
  const invoiceReceived = liquidation.specialist_invoice_url || liquidation.status === 'invoice_received';
  const invoiceStepStatus = invoiceReceived 
    ? 'completed' 
    : (currentIndex >= 3 && signature?.status === 'accepted' ? 'current' : 'pending');
  
  steps.push({
    id: 'invoice_received',
    label: 'Factura del especialista',
    status: invoiceStepStatus,
    description: invoiceReceived 
      ? 'Factura recibida del especialista'
      : 'Esperando factura del especialista',
    actions: invoiceReceived && liquidation.specialist_invoice_url ? (
      <Button 
        variant="link" 
        size="sm" 
        asChild
        className="h-auto p-0 mt-1"
      >
        <a href={liquidation.specialist_invoice_url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3 w-3 mr-1" />
          Ver factura
        </a>
      </Button>
    ) : undefined,
  });

  // 7. Pendiente de pago
  const showPaymentDate = currentIndex >= 4 || signature?.status === 'accepted';
  steps.push({
    id: 'pending_payment',
    label: 'Pendiente de pago',
    status: currentIndex >= 5 ? 'completed' : (currentIndex === 4 ? 'current' : 'pending'),
    description: showPaymentDate 
      ? `Pago previsto: ${formatExpectedPaymentDate(liquidation.period_year, liquidation.period_month)}`
      : undefined,
  });

  // 8. Pagada
  steps.push({
    id: 'paid',
    label: 'Pagada',
    status: currentIndex >= 6 ? 'completed' : (currentIndex === 5 ? 'current' : 'pending'),
    date: liquidation.paid_at ? formatDate(liquidation.paid_at) : undefined,
  });

  return steps;
};

const getStepIcon = (stepId: string, status: TimelineStep['status']) => {
  const iconClass = "h-5 w-5";
  
  // Error or warning states override the default icons
  if (status === 'error') {
    if (stepId === 'signature_disputed') {
      return <AlertTriangle className={iconClass} />;
    }
    return <AlertCircle className={iconClass} />;
  }
  
  if (status === 'warning') {
    return <Clock className={iconClass} />;
  }

  switch (stepId) {
    case 'draft':
      return <FileText className={iconClass} />;
    case 'validated':
      return <CheckCircle2 className={iconClass} />;
    case 'sent':
      return <Mail className={iconClass} />;
    case 'signature_pending':
    case 'signature_accepted':
    case 'signature_disputed':
      return status === 'completed' ? <CheckCircle2 className={iconClass} /> : <Clock className={iconClass} />;
    case 'accepted':
      return <CheckCircle2 className={iconClass} />;
    case 'invoice_received':
      return <Receipt className={iconClass} />;
    case 'pending_payment':
      return <Wallet className={iconClass} />;
    case 'paid':
      return <CircleCheck className={iconClass} />;
    default:
      return <FileText className={iconClass} />;
  }
};

const getStepStyles = (status: TimelineStep['status']) => {
  switch (status) {
    case 'completed':
      return {
        icon: 'bg-green-100 text-green-600 border-green-200',
        line: 'bg-green-300',
        text: 'text-foreground',
      };
    case 'current':
      return {
        icon: 'bg-primary/10 text-primary border-primary/20 ring-2 ring-primary/20',
        line: 'bg-muted',
        text: 'text-foreground font-medium',
      };
    case 'warning':
      return {
        icon: 'bg-yellow-100 text-yellow-600 border-yellow-200 ring-2 ring-yellow-200',
        line: 'bg-muted',
        text: 'text-yellow-700 font-medium',
      };
    case 'error':
      return {
        icon: 'bg-red-100 text-red-600 border-red-200 ring-2 ring-red-200',
        line: 'bg-muted',
        text: 'text-red-700 font-medium',
      };
    case 'pending':
    default:
      return {
        icon: 'bg-muted text-muted-foreground border-muted',
        line: 'bg-muted',
        text: 'text-muted-foreground',
      };
  }
};

export function LiquidationProcessTimeline({ 
  liquidation, 
  signature, 
  onResendEmail,
  isSending 
}: LiquidationProcessTimelineProps) {
  const steps = buildTimelineSteps(liquidation, signature, onResendEmail, isSending);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Proceso de Liquidación
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {steps.map((step, index) => {
            const styles = getStepStyles(step.status);
            const isLast = index === steps.length - 1;

            return (
              <div key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Vertical line */}
                {!isLast && (
                  <div 
                    className={cn(
                      "absolute left-[18px] top-10 w-0.5 h-[calc(100%-32px)]",
                      styles.line
                    )}
                  />
                )}

                {/* Icon circle */}
                <div 
                  className={cn(
                    "relative z-10 flex items-center justify-center w-9 h-9 rounded-full border shrink-0",
                    styles.icon
                  )}
                >
                  {getStepIcon(step.id, step.status)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("text-sm", styles.text)}>
                      {step.label}
                    </p>
                    {step.date && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {step.date}
                      </span>
                    )}
                  </div>
                  
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                  )}

                  {step.details && step.details.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {step.details.map((detail, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  )}

                  {step.actions}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
