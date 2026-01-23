import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/lib/invoice-utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, CreditCard } from 'lucide-react';

interface BulkPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: any[];
  onSuccess: () => void;
}

export const BulkPaymentModal = ({ isOpen, onClose, invoices, onSuccess }: BulkPaymentModalProps) => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [amountReceived, setAmountReceived] = useState('');
  const [notes, setNotes] = useState('');

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

  const handleSubmit = async () => {
    if (!paymentDate) {
      toast.error('La fecha de pago es requerida');
      return;
    }

    setIsLoading(true);
    try {
      const invoiceIds = invoices.map(inv => inv.id);
      
      const { error } = await supabase
        .from('invoices')
        .update({ 
          status: 'paid',
          paid_at: paymentDate
        })
        .in('id', invoiceIds);

      if (error) throw error;

      toast.success(`${invoices.length} facturas marcadas como pagadas`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error updating invoices:', error);
      toast.error('Error al actualizar las facturas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setAmountReceived('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Registrar Pago Masivo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Facturas a marcar como pagadas:</Label>
            <ScrollArea className="h-32 mt-2 rounded-md border">
              <div className="p-3 space-y-2">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex justify-between text-sm">
                    <span className="font-medium">{invoice.code}</span>
                    <span className="text-muted-foreground">{formatCurrency(invoice.total_amount)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-2 flex justify-between text-sm font-semibold border-t pt-2">
              <span>Total facturas:</span>
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

          <div className="space-y-2">
            <Label htmlFor="amountReceived">Importe recibido (opcional)</Label>
            <div className="relative">
              <Input
                id="amountReceived"
                type="number"
                step="0.01"
                min="0"
                placeholder={totalAmount.toFixed(2)}
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">EUR</span>
            </div>
            <p className="text-xs text-muted-foreground">Campo informativo, no se almacena</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Añade notas sobre el pago..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
