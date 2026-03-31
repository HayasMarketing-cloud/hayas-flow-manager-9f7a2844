import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { sendSlackDM, buildSlackDMToSpecialistBlocks } from '@/lib/slack-utils';

interface SlackDMButtonProps {
  request: any;
  compact?: boolean;
}

export const SlackDMButton = ({ request, compact = false }: SlackDMButtonProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState('');

  const specialist = request.specialist;
  const specialistEmail = specialist?.email;
  const specialistName = specialist?.name || 'Especialista';

  const handleSend = async () => {
    if (!specialistEmail) return;

    const blocks = buildSlackDMToSpecialistBlocks({
      code: request.code,
      title: request.title,
      clientName: request.client?.name ?? 'Cliente',
      deadline: request.deadline,
      requestId: request.id,
      customMessage: message || undefined,
    });

    await sendSlackDM(
      specialistEmail,
      `📩 Mensaje de Hayas Flow Manager: ${request.code} — ${request.title}`,
      blocks
    );

    toast.success(`DM enviado a ${specialistName}`);
    setDialogOpen(false);
    setMessage('');
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size={compact ? 'sm' : 'default'}
                variant="outline"
                disabled={!specialistEmail}
                onClick={() => setDialogOpen(true)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSend}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Enviar DM
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
