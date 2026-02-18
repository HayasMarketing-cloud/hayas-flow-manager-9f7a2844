import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useRequestActivityLog } from '@/hooks/useRequestActivityLog';
import { notifyRequestStatusChange } from '@/lib/notification-utils';
import { notificationFeedback } from '@/lib/notification-feedback';
import { sendSlackDM, buildSlackDMToSpecialistBlocks } from '@/lib/slack-utils';
import { 
  Send, 
  Check, 
  X, 
  PlayCircle, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Clock,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type NotificationType = 
  | 'specialist_assigned'
  | 'specialist_accepted'
  | 'specialist_rejected'
  | 'work_started'
  | 'work_completed'
  | 'request_approved'
  | 'request_rejected';

interface RequestFlowActionsProps {
  request: any;
  onSuccess?: () => void;
  compact?: boolean;
}

export const RequestFlowActions = ({ request, onSuccess, compact = false }: RequestFlowActionsProps) => {
  const { user } = useAuth();
  const { isAdmin, isProjectManager, isAccountManager, isSpecialist } = useUserRole();
  const { logActivity } = useRequestActivityLog();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: string;
    newStatus: string;
    notificationType: NotificationType;
    recipientEmail: string;
    recipientName: string;
  } | null>(null);
  const [message, setMessage] = useState('');
  const [slackDialogOpen, setSlackDialogOpen] = useState(false);
  const [slackMessage, setSlackMessage] = useState('');

  // Permission helpers
  const isManagement = () => isAdmin() || isProjectManager() || isAccountManager();
  
  const isAssignedSpecialist = () => {
    if (!isSpecialist()) return false;
    const specialistEmail = request.specialist?.email?.toLowerCase();
    const currentUserEmail = user?.email?.toLowerCase();
    return specialistEmail && currentUserEmail && specialistEmail === currentUserEmail;
  };

  const handleSendSlackDM = async () => {
    const specialist = request.specialist;
    const specialistEmail = specialist?.email;
    const specialistName = specialist?.name || 'Especialista';
    if (!specialistEmail) return;

    const blocks = buildSlackDMToSpecialistBlocks({
      code: request.code,
      title: request.title,
      clientName: request.client?.name ?? 'Cliente',
      deadline: request.deadline,
      requestId: request.id,
      customMessage: slackMessage || undefined,
    });

    await sendSlackDM(
      specialistEmail,
      `📩 Mensaje de Hayas Flow Manager: ${request.code} — ${request.title}`,
      blocks
    );

    toast.success(`DM enviado a ${specialistName}`);
    setSlackDialogOpen(false);
    setSlackMessage('');
  };


  const sendNotification = async (
    notificationType: NotificationType,
    recipientEmail: string,
    recipientName: string,
    additionalMessage?: string
  ) => {
    try {
      // Get sender's email from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user?.id)
        .single();

      const senderEmail = profile?.email || user?.email;

      if (!senderEmail?.endsWith('@hayas.es')) {
        console.warn('Sender email is not @hayas.es, notification not sent');
        return false;
      }

      const response = await supabase.functions.invoke('send-request-notification', {
        body: {
          requestId: request.id,
          notificationType,
          recipientEmail,
          recipientName,
          senderEmail,
          appUrl: window.location.origin,
          additionalMessage,
        },
      });

      if (response.error) {
        console.error('Error sending notification:', response.error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  };

  const updateRequestStatus = async (
    newStatus: string,
    notificationType?: NotificationType,
    recipientEmail?: string,
    recipientName?: string,
    additionalMessage?: string
  ) => {
    setIsLoading(true);
    const previousStatus = request.status;
    
    try {
      const updateData: any = { status: newStatus };
      
      // Set completed_at when moving to completed status
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      // Set specialist_acceptance based on action
      if (notificationType === 'specialist_accepted') {
        updateData.specialist_acceptance = true;
      } else if (notificationType === 'specialist_rejected') {
        updateData.specialist_acceptance = false;
      }

      const { error } = await supabase
        .from('financial_requests')
        .update(updateData)
        .eq('id', request.id);

      if (error) throw error;

      // Log the status change
      await logActivity({
        entityId: request.id,
        action: 'status_change',
        changes: { previous: previousStatus, new: newStatus }
      });

      // Create in-app notifications for status change
      await notifyRequestStatusChange(
        request.code,
        request.id,
        newStatus,
        user?.id
      );

      // Show feedback for in-app notification
      notificationFeedback.requestStatusChange(request.code);

      // Send notification if recipient provided
      if (notificationType && recipientEmail && recipientName) {
        const notificationSent = await sendNotification(
          notificationType,
          recipientEmail,
          recipientName,
          additionalMessage
        );

        // Log notification sent
        if (notificationSent) {
          await logActivity({
            entityId: request.id,
            action: 'notification_sent',
            changes: { recipient: recipientName, type: notificationType }
          });
          
          // Show email feedback
          notificationFeedback.emailToSpecialist(recipientName);
          toast.success('Estado actualizado y notificación enviada');
        } else {
          toast.success('Estado actualizado (notificación no enviada)');
        }
      } else {
        toast.success('Estado actualizado correctamente');
      }

      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
      queryClient.invalidateQueries({ queryKey: ['request-activity', request.id] });
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar el estado');
    } finally {
      setIsLoading(false);
      setConfirmOpen(false);
      setPendingAction(null);
      setMessage('');
    }
  };

  const handleAction = (
    action: string,
    newStatus: string,
    notificationType: NotificationType,
    recipientEmail: string,
    recipientName: string
  ) => {
    setPendingAction({ action, newStatus, notificationType, recipientEmail, recipientName });
    setConfirmOpen(true);
  };

  const confirmAction = () => {
    if (!pendingAction) return;
    updateRequestStatus(
      pendingAction.newStatus,
      pendingAction.notificationType,
      pendingAction.recipientEmail,
      pendingAction.recipientName,
      message || undefined
    );
  };

  // Determine which actions to show based on status and permissions
  const renderActions = () => {
    const status = request.status;
    const specialist = request.specialist;
    const specialistEmail = specialist?.email;
    const specialistName = specialist?.name || 'Especialista';

    // Get AM/PM email for notifications back to management
    const managementEmail = 'info@hayas.es';
    const managementName = 'Gestión';

    const buttonSize = compact ? 'sm' : 'default';
    const iconSize = compact ? 'h-3 w-3' : 'h-4 w-4';

    // Helper to render waiting message
    const renderWaitingMessage = (waitingFor: string) => (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className={iconSize} />
        <span>Esperando: {waitingFor}</span>
      </div>
    );

    switch (status) {
      case 'draft':
        // Only management can send to specialist
        if (!isManagement()) {
          return null;
        }
        if (!specialist || !specialistEmail) {
          return (
            <p className="text-sm text-muted-foreground">
              Asigna un especialista para enviar
            </p>
          );
        }
        return (
          <Button
            size={buttonSize}
            onClick={() => handleAction(
              'Enviar a Especialista',
              'pending_specialist',
              'specialist_assigned',
              specialistEmail,
              specialistName
            )}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className={`${iconSize} mr-2 animate-spin`} /> : <Send className={`${iconSize} mr-2`} />}
            Enviar a Especialista
          </Button>
        );

      case 'pending_specialist':
        // Only the assigned specialist can accept/reject
        if (!isAssignedSpecialist()) {
          // Management can resend notification
          if (isManagement()) {
            return (
              <div className="flex items-center gap-2">
                {renderWaitingMessage(specialistName)}
                <Button
                  size={buttonSize}
                  variant="outline"
                  onClick={() => handleAction(
                    'Reenviar Notificación',
                    'pending_specialist',
                    'specialist_assigned',
                    specialistEmail,
                    specialistName
                  )}
                  disabled={isLoading || !specialistEmail}
                  title="Reenviar email con nuevo enlace de acción"
                >
                  {isLoading ? <Loader2 className={`${iconSize} animate-spin`} /> : <RefreshCw className={iconSize} />}
                </Button>
              </div>
            );
          }
          return renderWaitingMessage(specialistName);
        }
        return (
          <div className="flex gap-2 flex-wrap">
            <Button
              size={buttonSize}
              variant="default"
              onClick={() => handleAction(
                'Aceptar Trabajo',
                'pending_approval',
                'specialist_accepted',
                managementEmail,
                managementName
              )}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className={`${iconSize} mr-2 animate-spin`} /> : <Check className={`${iconSize} mr-2`} />}
              Aceptar
            </Button>
            <Button
              size={buttonSize}
              variant="destructive"
              onClick={() => handleAction(
                'Rechazar Trabajo',
                'draft',
                'specialist_rejected',
                managementEmail,
                managementName
              )}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className={`${iconSize} mr-2 animate-spin`} /> : <X className={`${iconSize} mr-2`} />}
              Rechazar
            </Button>
          </div>
        );

      case 'pending_approval':
        // Only the assigned specialist can approve start
        if (!isAssignedSpecialist()) {
          if (isManagement()) {
            return renderWaitingMessage(`${specialistName} para aprobar inicio`);
          }
          return renderWaitingMessage('Aprobación del especialista');
        }
        return (
          <Button
            size={buttonSize}
            onClick={() => handleAction(
              'Aprobar Inicio',
              'in_progress',
              'work_started',
              managementEmail,
              managementName
            )}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className={`${iconSize} mr-2 animate-spin`} /> : <PlayCircle className={`${iconSize} mr-2`} />}
            Aprobar Inicio
          </Button>
        );

      case 'in_progress':
        // Only the assigned specialist can mark as completed
        if (!isAssignedSpecialist()) {
          return renderWaitingMessage(specialistName);
        }
        return (
          <Button
            size={buttonSize}
            onClick={() => handleAction(
              'Marcar como Terminado',
              'pending_review',
              'work_completed',
              managementEmail,
              managementName
            )}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className={`${iconSize} mr-2 animate-spin`} /> : <CheckCircle className={`${iconSize} mr-2`} />}
            Marcar Terminado
          </Button>
        );

      case 'pending_review':
        // Only management can approve/request corrections
        if (!isManagement()) {
          return renderWaitingMessage('Revisión de gestión');
        }
        return (
          <div className="flex gap-2 flex-wrap">
            <Button
              size={buttonSize}
              variant="default"
              onClick={() => handleAction(
                'Aprobar y Completar',
                'completed',
                'request_approved',
                specialistEmail || managementEmail,
                specialistName
              )}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className={`${iconSize} mr-2 animate-spin`} /> : <CheckCircle className={`${iconSize} mr-2`} />}
              Aprobar
            </Button>
            <Button
              size={buttonSize}
              variant="outline"
              onClick={() => handleAction(
                'Solicitar Correcciones',
                'in_progress',
                'request_rejected',
                specialistEmail || managementEmail,
                specialistName
              )}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className={`${iconSize} mr-2 animate-spin`} /> : <AlertCircle className={`${iconSize} mr-2`} />}
              Correcciones
            </Button>
          </div>
        );

      case 'completed':
      case 'cancelled':
        return null;

      default:
        return null;
    }
  };

  const actions = renderActions();
  const status = request.status;
  const specialist = request.specialist;
  const specialistEmail = specialist?.email;
  const specialistName = specialist?.name || 'Especialista';
  const showSlackButton =
    isManagement() &&
    specialist &&
    status !== 'completed' &&
    status !== 'cancelled';

  if (!actions && !showSlackButton) return null;


  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {actions}
        {showSlackButton && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size={compact ? 'sm' : 'default'}
                    variant="outline"
                    disabled={!specialistEmail}
                    onClick={() => setSlackDialogOpen(true)}
                    className="gap-1.5"
                  >
                    <MessageSquare className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                    {compact ? 'DM' : 'DM Slack'}
                  </Button>
                </span>
              </TooltipTrigger>
              {!specialistEmail && (
                <TooltipContent>El especialista no tiene email configurado</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar acción</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas <strong>{pendingAction?.action?.toLowerCase()}</strong>?
              {pendingAction?.recipientEmail && (
                <>
                  <br />
                  Se enviará una notificación a <strong>{pendingAction.recipientName}</strong>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <label className="text-sm font-medium">Mensaje adicional (opcional)</label>
            <Textarea
              placeholder="Añade un comentario o instrucciones..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={slackDialogOpen} onOpenChange={setSlackDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Enviar DM a {specialistName}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Se enviará un mensaje directo en Slack a <strong>{specialistEmail}</strong> con los detalles de la solicitud <strong>{request.code}</strong>.
            </p>
            <div>
              <label className="text-sm font-medium">Mensaje adicional (opcional)</label>
              <Textarea
                placeholder="Por favor, confirma disponibilidad antes del viernes..."
                value={slackMessage}
                onChange={(e) => setSlackMessage(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlackDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendSlackDM}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Enviar DM
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
