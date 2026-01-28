import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency, formatPeriod } from '@/lib/liquidation-utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, CreditCard } from 'lucide-react';

interface BulkLiquidationPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  liquidations: any[];
  onSuccess: () => void;
}

export const BulkLiquidationPaymentModal = ({ 
  isOpen, 
  onClose, 
  liquidations, 
  onSuccess 
}: BulkLiquidationPaymentModalProps) => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);

  const totalAmount = liquidations.reduce((sum, liq) => 
    sum + (liq.calculated_total ?? liq.total_amount ?? 0), 0
  );

  const handleSubmit = async () => {
    if (!paymentDate) {
      toast.error('La fecha de pago es requerida');
      return;
    }

    setIsLoading(true);
    try {
      const liquidationIds = liquidations.map(liq => liq.id);
      const paymentTimestamp = new Date(paymentDate).toISOString();
      
      const { error } = await supabase
        .from('liquidations')
        .update({ 
          status: 'paid',
          paid_at: paymentTimestamp
        })
        .in('id', liquidationIds);

      if (error) throw error;

      toast.success(`${liquidations.length} liquidaciones marcadas como pagadas`);
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error updating liquidations:', error);
      toast.error('Error al actualizar las liquidaciones: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPaymentDate(new Date().toISOString().split('T')[0]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Registrar Pago Masivo de Liquidaciones
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Liquidaciones a marcar como pagadas:</Label>
            <ScrollArea className="h-40 mt-2 rounded-md border">
              <div className="p-3 space-y-2">
                {liquidations.map((liquidation) => (
                  <div key={liquidation.id} className="flex justify-between text-sm">
                    <div>
                      <span className="font-medium">{liquidation.code}</span>
                      <span className="text-muted-foreground ml-2">
                        ({liquidation.specialist?.name})
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {formatCurrency(liquidation.calculated_total ?? liquidation.total_amount)}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-2 flex justify-between text-sm font-semibold border-t pt-2">
              <span>Total liquidaciones:</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentDate">Fecha de pago *</Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
