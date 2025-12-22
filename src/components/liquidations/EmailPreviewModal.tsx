import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mail, FileText, User, Calendar, Euro, Send, Loader2 } from 'lucide-react';

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liquidation: any;
  onConfirm: () => void;
  isSending: boolean;
}

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

export const EmailPreviewModal = ({
  open,
  onOpenChange,
  liquidation,
  onConfirm,
  isSending,
}: EmailPreviewModalProps) => {
  if (!liquidation) return null;

  const periodName = `${monthNames[(liquidation.period_month || 1) - 1]} ${liquidation.period_year}`;
  const totalAmount = liquidation.calculated_total ?? liquidation.total_amount ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Vista previa del email
          </DialogTitle>
          <DialogDescription>
            Revisa el contenido del email antes de enviarlo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email metadata */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-muted-foreground w-24">Para:</span>
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {liquidation.specialist?.name}
                  <span className="text-muted-foreground">
                    ({liquidation.specialist?.email})
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-muted-foreground w-24">Asunto:</span>
                <span>Liquidación {liquidation.code} - {periodName} - Pendiente de validación</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-muted-foreground w-24">Adjunto:</span>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Liquidacion_{liquidation.code}.pdf
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Email body preview */}
          <Card>
            <CardContent className="pt-4">
              <div className="border rounded-lg p-4 bg-background">
                <h3 className="text-lg font-semibold mb-4">
                  Liquidación {liquidation.code}
                </h3>
                
                <p className="mb-4">
                  Hola <strong>{liquidation.specialist?.name}</strong>,
                </p>
                
                <p className="mb-4">
                  Te enviamos la liquidación correspondiente al período <strong>{periodName}</strong>.
                </p>
                
                <div className="bg-muted rounded-lg p-4 my-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Código:</span>
                    </div>
                    <span className="font-medium">{liquidation.code}</span>
                    
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Período:</span>
                    </div>
                    <span className="font-medium">{periodName}</span>
                    
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Total:</span>
                    </div>
                    <span className="font-semibold text-primary text-lg">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>
                
                <p className="mb-4">
                  Por favor, revisa el documento adjunto y confirma que los datos son correctos.
                </p>
                <p className="mb-4">
                  Si tienes alguna discrepancia, no dudes en contactarnos.
                </p>
                
                <Separator className="my-4" />
                
                <p className="text-muted-foreground text-sm">
                  Saludos cordiales,<br />
                  <strong>El equipo de administración</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isSending}
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
