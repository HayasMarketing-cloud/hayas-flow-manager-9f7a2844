import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/invoice-utils';
import { useRegisterPayment } from '@/hooks/usePayments';
import { Loader2, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Invoice {
  id: string;
  code: string;
  total_amount: number;
  client?: { name: string };
  contract?: { code: string } | null;
  budget?: { code: string } | null;
}

interface PaymentRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  onSuccess: () => void;
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Transferencia bancaria' },
  { value: 'credit_card', label: 'Tarjeta de crédito' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'sdd', label: 'Domiciliación (SDD)' },
];

export const PaymentRegistrationModal = ({ 
  isOpen, 
  onClose, 
  invoices, 
  onSuccess 
}: PaymentRegistrationModalProps) => {
  const registerPayment = useRegisterPayment();
  
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'credit_card' | 'stripe' | 'sdd'>('bank_transfer');
  const [bankAccount, setBankAccount] = useState('');
  const [notes, setNotes] = useState('');

  const totalInvoices = useMemo(
    () => invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0),
    [invoices]
  );

  const amountReceived = amount ? parseFloat(amount) : totalInvoices;
  const difference = amountReceived - totalInvoices;

  const handleSubmit = async () => {
    if (!paymentDate) {
      return;
    }

    const finalAmount = amount ? parseFloat(amount) : totalInvoices;
    
    if (finalAmount <= 0) {
      return;
    }

    await registerPayment.mutateAsync({
      payment_date: paymentDate,
      amount: finalAmount,
      reference: reference || undefined,
      payment_method: paymentMethod,
      bank_account: bankAccount || undefined,
      notes: notes || undefined,
      invoices: invoices.map(inv => ({
        id: inv.id,
        allocated_amount: inv.total_amount,
      })),
    });

    onSuccess();
    handleClose();
  };

  const handleClose = () => {
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setReference('');
    setPaymentMethod('bank_transfer');
    setBankAccount('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Registrar Cobro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invoices list */}
          <div>
            <Label className="text-sm font-medium">Facturas a conciliar:</Label>
            <ScrollArea className="h-32 mt-2 rounded-md border">
              <div className="p-3 space-y-2">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex justify-between items-center text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium">{invoice.code}</span>
                      <span className="text-xs text-muted-foreground">
                        {invoice.client?.name}
                        {invoice.contract?.code && ` • ${invoice.contract.code}`}
                        {invoice.budget?.code && ` • ${invoice.budget.code}`}
                      </span>
                    </div>
                    <span className="font-medium">{formatCurrency(invoice.total_amount)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-2 flex justify-between text-sm font-semibold border-t pt-2">
              <span>Total facturas:</span>
              <span>{formatCurrency(totalInvoices)}</span>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium mb-3 block">Datos del Cobro</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentDate">Fecha de cobro *</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Importe recibido</Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={totalInvoices.toFixed(2)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">EUR</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Método de pago</Label>
                <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(method => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Referencia bancaria</Label>
                <Input
                  id="reference"
                  placeholder="TRF-123456..."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="bankAccount">Cuenta bancaria (opcional)</Label>
              <Input
                id="bankAccount"
                placeholder="ESXX XXXX XXXX XXXX"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
              />
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Notas adicionales sobre el cobro..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Balance summary */}
          <div className="border-t pt-4 space-y-2">
            <Label className="text-sm font-medium">Balance:</Label>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Importe recibido:</span>
                <span className="font-medium">{formatCurrency(amountReceived)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total facturas:</span>
                <span className="font-medium">{formatCurrency(totalInvoices)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span>Diferencia:</span>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${difference === 0 ? 'text-green-600' : difference > 0 ? 'text-blue-600' : 'text-destructive'}`}>
                    {formatCurrency(difference)}
                  </span>
                  {difference === 0 ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Cuadrado
                    </Badge>
                  ) : difference > 0 ? (
                    <Badge variant="outline" className="text-blue-600 border-blue-600">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Excedente
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-destructive border-destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Faltante
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={registerPayment.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={registerPayment.isPending || !paymentDate}>
            {registerPayment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Cobro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
