import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/liquidation-utils';
import { AlertCircle, FileText, Check, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AddToInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestIds: string[];
  onSuccess: () => void;
}

export const AddToInvoiceModal = ({
  open,
  onOpenChange,
  requestIds,
  onSuccess,
}: AddToInvoiceModalProps) => {
  const queryClient = useQueryClient();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');

  // Fetch selected requests with details
  const { data: selectedRequests, isLoading: loadingRequests } = useQuery({
    queryKey: ['selected-requests-for-invoice', requestIds],
    queryFn: async () => {
      if (requestIds.length === 0) return [];
      const { data, error } = await supabase
        .from('financial_requests')
        .select(`
          id, code, title, sale_amount, client_id, billed_invoice_id,
          client:clients(id, name)
        `)
        .in('id', requestIds);
      if (error) throw error;
      return data;
    },
    enabled: open && requestIds.length > 0,
  });

  // Get unique client from selected requests
  const clientInfo = useMemo(() => {
    if (!selectedRequests || selectedRequests.length === 0) return null;
    
    const clientIds = new Set(selectedRequests.map(r => r.client_id));
    if (clientIds.size === 0) return { error: 'no_client' };
    if (clientIds.size > 1) return { error: 'multiple_clients' };
    
    const firstRequest = selectedRequests[0];
    return {
      id: firstRequest.client_id,
      name: firstRequest.client?.name,
    };
  }, [selectedRequests]);

  // Check for already invoiced requests
  const alreadyInvoiced = useMemo(() => {
    if (!selectedRequests) return [];
    return selectedRequests.filter(r => r.billed_invoice_id !== null);
  }, [selectedRequests]);

  // Valid requests (not invoiced)
  const validRequests = useMemo(() => {
    if (!selectedRequests) return [];
    return selectedRequests.filter(r => r.billed_invoice_id === null);
  }, [selectedRequests]);

  // Fetch available invoices for this client
  const { data: availableInvoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['available-invoices-for-requests', clientInfo?.id],
    queryFn: async () => {
      if (!clientInfo?.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id, code, subtotal, total_amount, status, invoice_date')
        .eq('client_id', clientInfo.id)
        .neq('status', 'paid')
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clientInfo?.id,
  });

  // Calculate total sale amount from valid requests
  const totalSaleAmount = useMemo(() => {
    if (!validRequests) return 0;
    return validRequests.reduce((sum, r) => sum + (r.sale_amount || 0), 0);
  }, [validRequests]);

  // Get selected invoice details
  const selectedInvoice = useMemo(() => {
    return availableInvoices?.find(inv => inv.id === selectedInvoiceId);
  }, [availableInvoices, selectedInvoiceId]);

  // Check if amounts match (with tolerance of 0.01€)
  const amountsMatch = useMemo(() => {
    if (!selectedInvoice) return null;
    const diff = Math.abs(totalSaleAmount - selectedInvoice.subtotal);
    return diff <= 0.01;
  }, [totalSaleAmount, selectedInvoice]);

  // Mutation to add requests to invoice
  const addToInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoiceId || validRequests.length === 0) {
        throw new Error('Selecciona una factura');
      }

      // Update financial_requests with billed_invoice_id
      const { error } = await supabase
        .from('financial_requests')
        .update({ billed_invoice_id: selectedInvoiceId })
        .in('id', validRequests.map(r => r.id));

      if (error) throw error;

      return { 
        invoiceCode: selectedInvoice?.code, 
        count: validRequests.length 
      };
    },
    onSuccess: (result) => {
      toast.success(`${result.count} solicitudes asociadas a ${result.invoiceCode}`);
      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    addToInvoiceMutation.mutate();
  };

  const hasError = clientInfo?.error;
  const isLoading = loadingRequests || loadingInvoices;

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Borrador',
      sent: 'Enviada',
      pending: 'Pendiente',
      partially_paid: 'Parcialmente cobrada',
      paid: 'Cobrada',
      overdue: 'Vencida',
    };
    return labels[status] || status;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Añadir Solicitudes a Factura
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg font-medium text-destructive">
              {clientInfo?.error === 'no_client'
                ? 'Las solicitudes seleccionadas no tienen cliente asignado'
                : 'Las solicitudes seleccionadas pertenecen a diferentes clientes'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {clientInfo?.error === 'multiple_clients'
                ? 'Selecciona solicitudes del mismo cliente para añadirlas a una factura'
                : 'Las solicitudes deben tener un cliente asignado'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Client info */}
            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-sm text-muted-foreground">Cliente</Label>
              <p className="font-medium">{clientInfo?.name}</p>
            </div>

            {/* Already invoiced warning */}
            {alreadyInvoiced.length > 0 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  {alreadyInvoiced.length} solicitud(es) ya están facturadas y serán omitidas
                </p>
              </div>
            )}

            {/* Invoice selector */}
            <div className="space-y-2">
              <Label>Seleccionar factura</Label>
              {availableInvoices && availableInvoices.length > 0 ? (
                <Select
                  value={selectedInvoiceId}
                  onValueChange={setSelectedInvoiceId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una factura" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInvoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.code} - {format(new Date(inv.invoice_date), 'dd/MM/yyyy', { locale: es })} - {formatCurrency(inv.subtotal)} ({getStatusLabel(inv.status)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground p-3 border rounded-lg">
                  No hay facturas pendientes para este cliente
                </p>
              )}
            </div>

            {/* Requests table */}
            <div>
              <Label className="mb-2 block">
                Solicitudes a añadir ({validRequests.length})
              </Label>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead className="text-right">Importe de Venta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-mono text-xs">{req.code}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{req.title}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(req.sale_amount || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals comparison */}
            <div className="space-y-2 p-3 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total de ventas</span>
                <span className="font-medium">{formatCurrency(totalSaleAmount)}</span>
              </div>
              {selectedInvoice && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Subtotal factura</span>
                    <span className="font-medium">{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  <div className="pt-2 border-t">
                    {amountsMatch ? (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <Check className="h-4 w-4" />
                        <span className="text-sm">Los importes coinciden</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">
                          Diferencia: {formatCurrency(Math.abs(totalSaleAmount - selectedInvoice.subtotal))}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isLoading ||
              !!hasError ||
              validRequests.length === 0 ||
              !selectedInvoiceId ||
              addToInvoiceMutation.isPending
            }
          >
            {addToInvoiceMutation.isPending 
              ? 'Añadiendo...' 
              : `Añadir ${validRequests.length} Solicitud${validRequests.length !== 1 ? 'es' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
