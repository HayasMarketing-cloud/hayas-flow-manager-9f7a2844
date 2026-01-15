import { 
  Mail, 
  Clock, 
  AlertCircle, 
  AlertTriangle, 
  Wallet, 
  CircleCheck,
  CheckCircle2,
  PenLine
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatExpectedPaymentDate } from '@/lib/liquidation-utils';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';

type LiquidationStatus = Database['public']['Enums']['liquidation_status'];

interface TimelineStep {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending' | 'error' | 'warning';
  date?: string;
  description?: string;
}

interface SignatureData {
  status: string;
  expires_at: string;
  signed_at?: string;
  dispute_reason?: string;
  specialist_comments?: string;
}

interface SpecialistLiquidationData {
  status: LiquidationStatus;
  code: string;
  sent_at?: string | null;
  paid_at?: string | null;
  total_amount: number;
  period_year: number;
  period_month: number;
}

interface SpecialistLiquidationTimelineProps {
  liquidation: SpecialistLiquidationData;
  signature?: SignatureData | null;
}

const statusOrder: LiquidationStatus[] = ['draft', 'validated', 'sent', 'accepted', 'disputed', 'pending_payment', 'paid'];

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
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildSpecialistTimelineSteps = (
  liquidation: SpecialistLiquidationData,
  signature: SignatureData | null | undefined
): TimelineStep[] => {
  const steps: TimelineStep[] = [];
  const currentIndex = getStatusIndex(liquidation.status);

  // 1. Email recibido (sent_at)
  steps.push({
    id: 'email_received',
    label: 'Email recibido',
    status: liquidation.sent_at ? 'completed' : 'pending',
    date: liquidation.sent_at ? formatDateTime(liquidation.sent_at) : undefined,
    description: liquidation.sent_at 
      ? `Liquidación ${liquidation.code} recibida` 
      : 'Pendiente de envío',
  });

  // 2. Estado de firma del especialista
  if (signature) {
    const isExpired = new Date(signature.expires_at) < new Date();

    if (signature.status === 'pending') {
      steps.push({
        id: 'signature',
        label: isExpired ? 'Enlace expirado' : 'Pendiente de tu firma',
        status: isExpired ? 'error' : 'warning',
        description: isExpired 
          ? 'El enlace de firma ha expirado. Solicita un nuevo envío.'
          : 'Revisa y firma tu liquidación',
      });
    } else if (signature.status === 'accepted') {
      steps.push({
        id: 'signature',
        label: 'Firmada por ti',
        status: 'completed',
        date: formatDateTime(signature.signed_at),
        description: signature.specialist_comments || 'Aceptada sin comentarios',
      });
    } else if (signature.status === 'disputed') {
      steps.push({
        id: 'signature',
        label: 'Disputada por ti',
        status: 'error',
        date: formatDateTime(signature.signed_at),
        description: signature.dispute_reason || 'En revisión',
      });
    }
  } else if (liquidation.sent_at) {
    // Enviada pero sin registro de firma
    steps.push({
      id: 'signature',
      label: 'Pendiente de tu firma',
      status: 'current',
      description: 'Revisa y firma tu liquidación',
    });
  } else {
    steps.push({
      id: 'signature',
      label: 'Pendiente de firma',
      status: 'pending',
      description: 'Se habilitará cuando recibas el email',
    });
  }

  // 3. Pendiente de pago (con fecha prevista si ya firmó)
  const isSignedOrPending = signature?.status === 'accepted' || currentIndex >= 3;
  steps.push({
    id: 'pending_payment',
    label: 'Pendiente de pago',
    status: currentIndex >= 4 ? 'completed' : (isSignedOrPending ? 'current' : 'pending'),
    description: isSignedOrPending 
      ? `Pago previsto: ${formatExpectedPaymentDate(liquidation.period_year, liquidation.period_month)}`
      : 'Se habilitará tras la firma',
  });

  // 4. Pagada - Solo se muestra cuando está realmente pagada
  if (liquidation.status === 'paid') {
    steps.push({
      id: 'paid',
      label: 'Pagada',
      status: 'completed',
      date: liquidation.paid_at ? formatDate(liquidation.paid_at) : undefined,
      description: 'Pago completado',
    });
  }

  return steps;
};

const getStepIcon = (stepId: string, status: TimelineStep['status']) => {
  const iconClass = "h-5 w-5";
  
  if (status === 'error') {
    if (stepId === 'signature') {
      return <AlertTriangle className={iconClass} />;
    }
    return <AlertCircle className={iconClass} />;
  }
  
  if (status === 'warning') {
    return <Clock className={iconClass} />;
  }

  switch (stepId) {
    case 'email_received':
      return <Mail className={iconClass} />;
    case 'signature':
      return status === 'completed' ? <CheckCircle2 className={iconClass} /> : <PenLine className={iconClass} />;
    case 'pending_payment':
      return <Wallet className={iconClass} />;
    case 'paid':
      return <CircleCheck className={iconClass} />;
    default:
      return <Mail className={iconClass} />;
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

export function SpecialistLiquidationTimeline({ 
  liquidation, 
  signature 
}: SpecialistLiquidationTimelineProps) {
  const steps = buildSpecialistTimelineSteps(liquidation, signature);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Proceso de tu Liquidación
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {steps.map((step, index) => {
            const styles = getStepStyles(step.status);
            const isLast = index === steps.length - 1;

            return (
              <div key={step.id} className="relative flex gap-4 pb-5 last:pb-0">
                {/* Vertical line */}
                {!isLast && (
                  <div 
                    className={cn(
                      "absolute left-[18px] top-10 w-0.5 h-[calc(100%-28px)]",
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
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
