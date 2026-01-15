import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Send, 
  UserCheck, 
  UserX, 
  Clock, 
  PlayCircle, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  XCircle,
  Hourglass,
  ClipboardCheck
} from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

type RequestStatus = 
  | 'draft'
  | 'pending_specialist'
  | 'accepted'
  | 'rejected'
  | 'pending_approval'
  | 'in_progress'
  | 'pending_review'
  | 'completed'
  | 'billed'
  | 'cancelled';

type TimelineStepStatus = 'completed' | 'current' | 'pending' | 'error' | 'warning' | 'skipped';

interface TimelineStep {
  id: string;
  label: string;
  status: TimelineStepStatus;
  date?: string;
  description?: string;
}

interface RequestActionToken {
  id: string;
  token: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  acted_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  comments: string | null;
  expires_at: string;
  created_at: string;
}

interface RequestData {
  id: string;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  specialist?: { name: string; email: string } | null;
}

interface RequestProcessTimelineProps {
  request: RequestData;
  actionToken?: RequestActionToken | null;
  onResendEmail?: () => void;
  isSending?: boolean;
}

const statusOrder: RequestStatus[] = [
  'draft',
  'pending_specialist',
  'accepted',
  'pending_approval',
  'in_progress',
  'pending_review',
  'completed',
  'billed'
];

const getStatusIndex = (status: RequestStatus): number => {
  const idx = statusOrder.indexOf(status);
  return idx >= 0 ? idx : 0;
};

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), "d MMM yyyy", { locale: es });
  } catch {
    return '';
  }
};

const formatDateTime = (dateString?: string | null): string => {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), "d MMM yyyy, HH:mm", { locale: es });
  } catch {
    return '';
  }
};

const buildTimelineSteps = (
  request: RequestData,
  actionToken?: RequestActionToken | null
): TimelineStep[] => {
  const currentStatusIndex = getStatusIndex(request.status);
  const steps: TimelineStep[] = [];

  // 1. Borrador creado
  steps.push({
    id: 'draft',
    label: 'Solicitud creada',
    status: 'completed',
    date: formatDate(request.created_at),
    description: 'Solicitud registrada en el sistema',
  });

  // 2. Enviado a especialista
  if (request.status === 'draft') {
    steps.push({
      id: 'pending_specialist',
      label: 'Enviar a especialista',
      status: 'pending',
      description: request.specialist ? `Pendiente enviar a ${request.specialist.name}` : 'Sin especialista asignado',
    });
  } else if (actionToken) {
    steps.push({
      id: 'pending_specialist',
      label: 'Enviado a especialista',
      status: 'completed',
      date: formatDateTime(actionToken.created_at),
      description: request.specialist ? `Email enviado a ${request.specialist.email}` : 'Email enviado',
    });
  } else if (currentStatusIndex >= getStatusIndex('pending_specialist')) {
    steps.push({
      id: 'pending_specialist',
      label: 'Enviado a especialista',
      status: 'completed',
      description: request.specialist?.name || 'Especialista asignado',
    });
  }

  // 3. Respuesta del especialista
  if (request.status === 'rejected') {
    steps.push({
      id: 'specialist_response',
      label: 'Rechazado por especialista',
      status: 'error',
      date: actionToken?.acted_at ? formatDateTime(actionToken.acted_at) : undefined,
      description: actionToken?.comments || 'El especialista rechazó la solicitud',
    });
  } else if (request.status === 'cancelled') {
    steps.push({
      id: 'specialist_response',
      label: 'Solicitud cancelada',
      status: 'error',
      description: 'La solicitud fue cancelada',
    });
  } else if (request.status === 'pending_specialist') {
    // Check if token is expired
    const isExpired = actionToken?.expires_at && isPast(parseISO(actionToken.expires_at));
    
    if (isExpired) {
      steps.push({
        id: 'specialist_response',
        label: 'Enlace expirado',
        status: 'error',
        description: 'El enlace de respuesta ha expirado',
      });
    } else {
      steps.push({
        id: 'specialist_response',
        label: 'Esperando respuesta',
        status: 'warning',
        description: actionToken?.expires_at 
          ? `Válido hasta ${formatDateTime(actionToken.expires_at)}`
          : 'Pendiente respuesta del especialista',
      });
    }
  } else if (currentStatusIndex >= getStatusIndex('accepted')) {
    steps.push({
      id: 'specialist_response',
      label: 'Aceptado por especialista',
      status: 'completed',
      date: actionToken?.acted_at ? formatDateTime(actionToken.acted_at) : undefined,
      description: actionToken?.comments || 'El especialista aceptó el trabajo',
    });
  }

  // Skip remaining steps if rejected or cancelled
  if (request.status === 'rejected' || request.status === 'cancelled') {
    return steps;
  }

  // 4. Pendiente aprobación
  if (request.status === 'pending_approval') {
    steps.push({
      id: 'pending_approval',
      label: 'Pendiente aprobación',
      status: 'current',
      description: 'Esperando aprobación de gestión',
    });
  } else if (currentStatusIndex > getStatusIndex('pending_approval') || request.status === 'accepted') {
    if (request.status === 'accepted') {
      steps.push({
        id: 'pending_approval',
        label: 'Pendiente aprobación',
        status: 'current',
        description: 'Esperando aprobación para iniciar',
      });
    } else {
      steps.push({
        id: 'pending_approval',
        label: 'Aprobado',
        status: 'completed',
        description: 'Trabajo aprobado para comenzar',
      });
    }
  } else if (currentStatusIndex < getStatusIndex('pending_approval')) {
    steps.push({
      id: 'pending_approval',
      label: 'Pendiente aprobación',
      status: 'pending',
    });
  }

  // 5. En progreso
  if (request.status === 'in_progress') {
    steps.push({
      id: 'in_progress',
      label: 'En progreso',
      status: 'current',
      description: 'El especialista está trabajando',
    });
  } else if (currentStatusIndex > getStatusIndex('in_progress')) {
    steps.push({
      id: 'in_progress',
      label: 'En progreso',
      status: 'completed',
      description: 'Trabajo realizado',
    });
  } else {
    steps.push({
      id: 'in_progress',
      label: 'En progreso',
      status: 'pending',
    });
  }

  // 6. Revisión final
  if (request.status === 'pending_review') {
    steps.push({
      id: 'pending_review',
      label: 'Revisión final',
      status: 'current',
      description: 'Pendiente revisión de calidad',
    });
  } else if (currentStatusIndex > getStatusIndex('pending_review')) {
    steps.push({
      id: 'pending_review',
      label: 'Revisión completada',
      status: 'completed',
    });
  } else {
    steps.push({
      id: 'pending_review',
      label: 'Revisión final',
      status: 'pending',
    });
  }

  // 7. Completado
  if (request.status === 'completed' || request.status === 'billed') {
    steps.push({
      id: 'completed',
      label: 'Completado',
      status: 'completed',
      date: request.status === 'completed' ? formatDate(request.updated_at) : undefined,
      description: 'Trabajo finalizado',
    });
  } else {
    steps.push({
      id: 'completed',
      label: 'Completado',
      status: 'pending',
    });
  }

  // 8. Facturado (optional)
  if (request.status === 'billed') {
    steps.push({
      id: 'billed',
      label: 'Facturado',
      status: 'completed',
      date: formatDate(request.updated_at),
      description: 'Incluido en factura',
    });
  }

  return steps;
};

const getStepIcon = (stepId: string, status: TimelineStepStatus) => {
  const iconProps = { className: 'h-4 w-4' };
  
  if (status === 'error') {
    if (stepId === 'specialist_response') return <UserX {...iconProps} />;
    return <XCircle {...iconProps} />;
  }
  
  if (status === 'warning') {
    return <Hourglass {...iconProps} />;
  }

  switch (stepId) {
    case 'draft':
      return <FileText {...iconProps} />;
    case 'pending_specialist':
      return <Send {...iconProps} />;
    case 'specialist_response':
      return status === 'completed' ? <UserCheck {...iconProps} /> : <Clock {...iconProps} />;
    case 'pending_approval':
      return <ClipboardCheck {...iconProps} />;
    case 'in_progress':
      return <PlayCircle {...iconProps} />;
    case 'pending_review':
      return <AlertCircle {...iconProps} />;
    case 'completed':
    case 'billed':
      return <CheckCircle2 {...iconProps} />;
    default:
      return <Clock {...iconProps} />;
  }
};

const getStepStyles = (status: TimelineStepStatus) => {
  switch (status) {
    case 'completed':
      return {
        icon: 'bg-green-100 text-green-600 border-green-200',
        line: 'bg-green-200',
        text: 'text-foreground',
      };
    case 'current':
      return {
        icon: 'bg-blue-100 text-blue-600 border-blue-200 ring-2 ring-blue-300',
        line: 'bg-muted',
        text: 'text-foreground font-medium',
      };
    case 'warning':
      return {
        icon: 'bg-amber-100 text-amber-600 border-amber-200 animate-pulse',
        line: 'bg-muted',
        text: 'text-amber-700',
      };
    case 'error':
      return {
        icon: 'bg-red-100 text-red-600 border-red-200',
        line: 'bg-red-200',
        text: 'text-red-700',
      };
    case 'skipped':
      return {
        icon: 'bg-muted text-muted-foreground border-muted',
        line: 'bg-muted',
        text: 'text-muted-foreground line-through',
      };
    default:
      return {
        icon: 'bg-muted text-muted-foreground border-muted',
        line: 'bg-muted',
        text: 'text-muted-foreground',
      };
  }
};

export const RequestProcessTimeline = ({
  request,
  actionToken,
  onResendEmail,
  isSending = false,
}: RequestProcessTimelineProps) => {
  const steps = buildTimelineSteps(request, actionToken);
  
  // Check if we should show resend button
  const isExpired = actionToken?.expires_at && isPast(parseISO(actionToken.expires_at));
  const showResendButton = 
    request.status === 'pending_specialist' && 
    (isExpired || !actionToken) && 
    request.specialist?.email &&
    onResendEmail;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Proceso de la solicitud
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {steps.map((step, index) => {
            const styles = getStepStyles(step.status);
            const isLast = index === steps.length - 1;

            return (
              <div key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
                {/* Vertical line */}
                {!isLast && (
                  <div 
                    className={`absolute left-[15px] top-8 w-0.5 h-[calc(100%-20px)] ${styles.line}`}
                  />
                )}
                
                {/* Icon */}
                <div 
                  className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border ${styles.icon}`}
                >
                  {getStepIcon(step.id, step.status)}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm ${styles.text}`}>
                      {step.label}
                    </span>
                    {step.date && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {step.date}
                      </span>
                    )}
                  </div>
                  
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {step.description}
                    </p>
                  )}

                  {/* Resend button */}
                  {step.id === 'specialist_response' && showResendButton && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 text-xs"
                      onClick={onResendEmail}
                      disabled={isSending}
                    >
                      {isSending ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Reenviar email
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
