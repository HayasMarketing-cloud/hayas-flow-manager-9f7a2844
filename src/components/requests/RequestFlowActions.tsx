import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Wallet, CheckCircle2 } from 'lucide-react';
import { getRequestFlowStatus } from '@/lib/flowHelpers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface RequestFlowActionsProps {
  request: any;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const RequestFlowActions = ({ request, variant = 'outline', size = 'sm' }: RequestFlowActionsProps) => {
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [liquidationDialogOpen, setLiquidationDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const flowStatus = getRequestFlowStatus(request);

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      // 1. Crear la factura
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          code: '', // Se genera automáticamente por el trigger
          client_id: request.client_id,
          invoice_date: new Date().toISOString().split('T')[0],
          status: 'draft',
          subtotal: request.total,
          tax_rate: 21,
          tax_amount: request.total * 0.21,
          total_amount: request.total * 1.21,
          notes: `Generada desde solicitud ${request.code}`,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // 2. Crear el invoice_item vinculado al request
      const { error: itemError } = await supabase
        .from('invoice_items')
        .insert({
          invoice_id: invoice.id,
          request_id: request.id,
          description: request.title,
          quantity: request.quantity,
          unit_price: request.unit_price,
          total: request.total,
        });

      if (itemError) throw itemError;

      // 3. Actualizar el request con el invoice_id
      const { error: updateError } = await supabase
        .from('requests')
        .update({ 
          billed_invoice_id: invoice.id,
          status: 'billed'
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      return invoice;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['requests-with-flow'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(`Factura ${invoice.code} creada exitosamente`);
      setInvoiceDialogOpen(false);
      navigate(`/facturas`);
    },
    onError: (error: any) => {
      toast.error(`Error al crear factura: ${error.message}`);
    },
  });

  const addToLiquidationMutation = useMutation({
    mutationFn: async (liquidationId: string) => {
      // 1. Crear liquidation_item
      const { error: itemError } = await supabase
        .from('liquidation_items')
        .insert({
          liquidation_id: liquidationId,
          request_id: request.id,
          description: request.title,
          quantity: request.quantity,
          unit_price: request.cost || request.unit_price * 0.7, // 70% como comisión por defecto
          total: (request.cost || request.unit_price * 0.7) * request.quantity,
        });

      if (itemError) throw itemError;

      // 2. Actualizar el request con el liquidation_id
      const { error: updateError } = await supabase
        .from('requests')
        .update({ liquidation_id: liquidationId })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // 3. Recalcular totales de la liquidación
      const { data: items, error: itemsError } = await supabase
        .from('liquidation_items')
        .select('total')
        .eq('liquidation_id', liquidationId);

      if (itemsError) throw itemsError;

      const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
      const taxAmount = subtotal * 0.21;
      const totalAmount = subtotal + taxAmount;

      const { error: liquidationError } = await supabase
        .from('liquidations')
        .update({
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
        })
        .eq('id', liquidationId);

      if (liquidationError) throw liquidationError;

      return liquidationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['requests-with-flow'] });
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      toast.success('Request agregado a liquidación exitosamente');
      setLiquidationDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Error al agregar a liquidación: ${error.message}`);
    },
  });

  const handleGenerateInvoice = () => {
    createInvoiceMutation.mutate();
  };

  if (!flowStatus.canGenerateInvoice && !flowStatus.canAddToLiquidation) {
    return null;
  }

  return (
    <>
      <div className="flex gap-2">
        {flowStatus.canGenerateInvoice && (
          <Button
            variant={variant}
            size={size}
            onClick={() => setInvoiceDialogOpen(true)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Facturar
          </Button>
        )}

        {flowStatus.canAddToLiquidation && (
          <Button
            variant={variant}
            size={size}
            onClick={() => setLiquidationDialogOpen(true)}
          >
            <Wallet className="h-4 w-4 mr-2" />
            Liquidar
          </Button>
        )}
      </div>

      {/* Invoice Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar Factura</DialogTitle>
            <DialogDescription>
              Se creará una factura automáticamente para esta solicitud
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-md space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Solicitud:</span>
                <span className="font-medium">{request.code}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{request.client?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Descripción:</span>
                <span className="font-medium">{request.title}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{request.total?.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA (21%):</span>
                <span className="font-medium">{(request.total * 0.21).toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>Total:</span>
                <span>{(request.total * 1.21).toFixed(2)} €</span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleGenerateInvoice}
                disabled={createInvoiceMutation.isPending}
              >
                {createInvoiceMutation.isPending ? 'Creando...' : 'Generar Factura'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Liquidation Dialog */}
      <Dialog open={liquidationDialogOpen} onOpenChange={setLiquidationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar a Liquidación</DialogTitle>
            <DialogDescription>
              Selecciona la liquidación a la que deseas agregar esta solicitud
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-md space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Solicitud:</span>
                <span className="font-medium">{request.code}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Especialista:</span>
                <span className="font-medium">{request.specialist?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Comisión estimada:</span>
                <span className="font-medium">
                  {((request.cost || request.unit_price * 0.7) * request.quantity).toFixed(2)} €
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Esta funcionalidad se completará próximamente. Por ahora, dirígete a la sección de 
              Liquidaciones para gestionar manualmente.
            </p>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setLiquidationDialogOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
