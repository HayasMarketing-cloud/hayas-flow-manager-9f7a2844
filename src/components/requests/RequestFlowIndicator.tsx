import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { FileText, User, CheckCircle, Briefcase, Eye, Flag, XCircle } from 'lucide-react';

type FinancialRequestStatus = Database['public']['Enums']['financial_request_status'];

interface RequestFlowIndicatorProps {
  status: FinancialRequestStatus;
  className?: string;
  compact?: boolean;
}

const FLOW_STEPS = [
  { key: 'draft', label: 'Borrador', icon: FileText, short: 'D' },
  { key: 'pending_specialist', label: 'Especialista', icon: User, short: 'S' },
  { key: 'pending_approval', label: 'Aprobación', icon: CheckCircle, short: 'A' },
  { key: 'in_progress', label: 'En Progreso', icon: Briefcase, short: 'P' },
  { key: 'pending_review', label: 'Revisión', icon: Eye, short: 'R' },
  { key: 'completed', label: 'Completado', icon: Flag, short: 'C' },
] as const;

const STATUS_ORDER: Record<FinancialRequestStatus, number> = {
  draft: 0,
  pending_specialist: 1,
  pending_approval: 2,
  in_progress: 3,
  pending_review: 4,
  completed: 5,
  cancelled: -1,
};

export const RequestFlowIndicator = ({ status, className, compact = false }: RequestFlowIndicatorProps) => {
  if (status === 'cancelled') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1", className)}>
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive text-destructive-foreground">
                <XCircle className="h-4 w-4" />
              </div>
              {!compact && <span className="text-xs text-destructive font-medium">Cancelado</span>}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Request cancelado</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const currentIndex = STATUS_ORDER[status];

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-0.5", className)}>
        {FLOW_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;
          const StepIcon = step.icon;

          return (
            <Tooltip key={step.key}>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-full transition-all",
                      compact ? "w-5 h-5" : "w-6 h-6",
                      isCompleted && "bg-green-500 text-white",
                      isCurrent && "bg-blue-500 text-white ring-2 ring-blue-300 ring-offset-1",
                      isPending && "bg-muted text-muted-foreground"
                    )}
                  >
                    {compact ? (
                      <span className="text-[10px] font-bold">{step.short}</span>
                    ) : (
                      <StepIcon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  {index < FLOW_STEPS.length - 1 && (
                    <div
                      className={cn(
                        "h-0.5 transition-all",
                        compact ? "w-1" : "w-2",
                        index < currentIndex ? "bg-green-500" : "bg-muted"
                      )}
                    />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{step.label}</p>
                <p className="text-xs text-muted-foreground">
                  {isCompleted ? 'Completado' : isCurrent ? 'Estado actual' : 'Pendiente'}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};