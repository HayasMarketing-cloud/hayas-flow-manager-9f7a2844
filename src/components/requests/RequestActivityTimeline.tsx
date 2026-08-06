import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Clock, 
  Plus, 
  Edit, 
  Send, 
  Check, 
  X, 
  Play, 
  CheckCircle, 
  AlertCircle,
  Copy,
  FileText,
  Receipt,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RequestActivityTimelineProps {
  requestId: string;
}

interface ActivityItem {
  id: string;
  created_at: string;
  action: string;
  changes: Record<string, any> | null;
  source: 'activity' | 'token';
  user_email?: string;
  ip_address?: string;
  user_agent?: string;
  comments?: string;
  status?: string;
}

const getActionIcon = (action: string) => {
  switch (action) {
    case 'created':
      return <Plus className="h-4 w-4" />;
    case 'updated':
      return <Edit className="h-4 w-4" />;
    case 'cloned':
      return <Copy className="h-4 w-4" />;
    case 'status_change':
    case 'notification_sent':
      return <Send className="h-4 w-4" />;
    case 'specialist_accepted':
      return <Check className="h-4 w-4" />;
    case 'specialist_rejected':
      return <X className="h-4 w-4" />;
    case 'work_started':
      return <Play className="h-4 w-4" />;
    case 'work_completed':
    case 'request_approved':
      return <CheckCircle className="h-4 w-4" />;
    case 'request_rejected':
      return <AlertCircle className="h-4 w-4" />;
    case 'assigned_to_invoice':
      return <FileText className="h-4 w-4" />;
    case 'assigned_to_liquidation':
      return <Receipt className="h-4 w-4" />;
    case 'resend_notification':
      return <RefreshCw className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getActionColor = (action: string) => {
  switch (action) {
    case 'created':
      return 'bg-green-500';
    case 'specialist_accepted':
    case 'work_completed':
    case 'request_approved':
      return 'bg-emerald-500';
    case 'specialist_rejected':
    case 'request_rejected':
      return 'bg-red-500';
    case 'status_change':
    case 'notification_sent':
      return 'bg-blue-500';
    default:
      return 'bg-muted-foreground';
  }
};

const getActionLabel = (action: string, changes?: Record<string, any> | null) => {
  switch (action) {
    case 'created':
      return 'Solicitud creada';
    case 'updated':
      return 'Solicitud actualizada';
    case 'cloned':
      return `Solicitud clonada${changes?.from_code ? ` desde ${changes.from_code}` : ''}`;
    case 'status_change':
      if (changes?.previous && changes?.new) {
        return `Estado cambiado: ${getStatusLabel(changes.previous)} → ${getStatusLabel(changes.new)}`;
      }
      return 'Estado cambiado';
    case 'notification_sent':
      return `Notificación enviada${changes?.recipient ? ` a ${changes.recipient}` : ''}`;
    case 'resend_notification':
      return 'Notificación reenviada';
    case 'specialist_accepted':
      return 'Especialista aceptó el trabajo';
    case 'specialist_rejected':
      return 'Especialista rechazó el trabajo';
    case 'work_started':
      return 'Trabajo iniciado';
    case 'work_completed':
      return 'Trabajo marcado como terminado';
    case 'request_approved':
      return 'Solicitud aprobada y completada';
    case 'request_rejected':
      return 'Se solicitaron correcciones';
    case 'assigned_to_invoice':
      return `Asignada a factura${changes?.invoice_code ? ` ${changes.invoice_code}` : ''}`;
    case 'assigned_to_liquidation':
      return `Asignada a liquidación${changes?.liquidation_code ? ` ${changes.liquidation_code}` : ''}`;
    default:
      return action;
  }
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    draft: 'Borrador',
    pending_specialist: 'Pend. Especialista',
    in_progress: 'En Progreso',
    pending_review: 'Pend. Revisión',
    completed: 'Completado',
    cancelled: 'Cancelado',
  };
  return labels[status] || status;
};

export const RequestActivityTimeline = ({ requestId }: RequestActivityTimelineProps) => {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['request-activity', requestId],
    queryFn: async () => {
      // Fetch activity_log entries
      const { data: activityLogs, error: activityError } = await supabase
        .from('activity_log')
        .select('id, created_at, action, changes, user_id')
        .eq('entity_type', 'financial_request')
        .eq('entity_id', requestId)
        .order('created_at', { ascending: false });

      if (activityError) throw activityError;

      // Fetch request_action_tokens
      const { data: tokens, error: tokensError } = await supabase
        .from('request_action_tokens')
        .select('id, created_at, acted_at, action_type, status, ip_address, user_agent, comments')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false });

      if (tokensError) throw tokensError;

      // Fetch user emails for activity logs
      const userIds = [...new Set(activityLogs?.map(a => a.user_id).filter(Boolean))];
      let userEmails: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds);
        
        userEmails = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.email;
          return acc;
        }, {} as Record<string, string>);
      }

      // Convert activity_log to unified format
      const activityItems: ActivityItem[] = (activityLogs || []).map(log => ({
        id: log.id,
        created_at: log.created_at || '',
        action: log.action,
        changes: log.changes as Record<string, any> | null,
        source: 'activity' as const,
        user_email: log.user_id ? userEmails[log.user_id] : undefined,
      }));

      // Convert tokens to unified format
      const tokenItems: ActivityItem[] = [];
      for (const token of tokens || []) {
        // Token creation = notification sent
        tokenItems.push({
          id: `${token.id}-created`,
          created_at: token.created_at || '',
          action: 'notification_sent',
          changes: { type: token.action_type },
          source: 'token' as const,
        });

        // If token was used, add the action
        if (token.status && token.status !== 'pending' && token.acted_at) {
          tokenItems.push({
            id: `${token.id}-action`,
            created_at: token.acted_at,
            action: token.status === 'accepted' ? 'specialist_accepted' : 'specialist_rejected',
            changes: null,
            source: 'token' as const,
            ip_address: token.ip_address || undefined,
            user_agent: token.user_agent || undefined,
            comments: token.comments || undefined,
            status: token.status,
          });
        }
      }

      // Combine and sort by date (newest first)
      const allItems = [...activityItems, ...tokenItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return allItems;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No hay actividad registrada</p>
        <p className="text-sm">Los eventos aparecerán aquí a medida que se realicen acciones</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-6">
        {activities.map((activity, index) => (
          <div key={activity.id} className="relative flex gap-4 pl-8">
            {/* Timeline dot */}
            <div 
              className={cn(
                "absolute left-0 h-8 w-8 rounded-full flex items-center justify-center text-white",
                getActionColor(activity.action)
              )}
            >
              {getActionIcon(activity.action)}
            </div>

            {/* Content */}
            <div className="flex-1 pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {getActionLabel(activity.action, activity.changes)}
                  </p>
                  {activity.user_email && (
                    <p className="text-sm text-muted-foreground">
                      Por: {activity.user_email}
                    </p>
                  )}
                  {activity.comments && (
                    <p className="text-sm mt-1 bg-muted p-2 rounded border-l-2 border-primary">
                      "{activity.comments}"
                    </p>
                  )}
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(activity.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                </time>
              </div>

              {/* Extra details for token actions */}
              {activity.ip_address && (
                <p className="text-xs text-muted-foreground mt-1">
                  IP: {activity.ip_address}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
