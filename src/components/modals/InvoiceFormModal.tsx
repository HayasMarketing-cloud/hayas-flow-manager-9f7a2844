import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calculateTaxAmount, calculateTotalAmount, calculateDueDate } from '@/lib/invoice-utils';
import { generateInvoicePDF } from '@/utils/pdf/invoicePDFGenerator';
import { FileDown } from 'lucide-react';

const invoiceSchema = z.object({
  client_id: z.string().uuid('Selecciona un cliente'),
  invoice_date: z.string().min(1, 'Fecha requerida'),
  due_date: z.string().optional().nullable(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  subtotal: z.coerce.number().min(0, 'Debe ser positivo'),
  tax_rate: z.coerce.number().min(0).max(100, 'Máximo 100%'),
  tax_amount: z.coerce.number().min(0),
  total_amount: z.coerce.number().min(0),
  notes: z.string().optional().nullable(),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface InvoiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any | null;
  mode: 'create' | 'edit' | 'view';
}

export const InvoiceFormModal = ({ isOpen, onClose, invoice, mode }: InvoiceFormModalProps) => {
  const queryClient = useQueryClient();
  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      client_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: null,
      status: 'draft',
      subtotal: 0,
      tax_rate: 21,
      tax_amount: 0,
      total_amount: 0,
      notes: null,
    },
  });

  const subtotal = useWatch({ control: form.control, name: 'subtotal' });
  const taxRate = useWatch({ control: form.control, name: 'tax_rate' });
  const invoiceDate = useWatch({ control: form.control, name: 'invoice_date' });

  useEffect(() => {
    if (subtotal !== undefined && taxRate !== undefined) {
      const calculatedTax = calculateTaxAmount(subtotal, taxRate);
      const calculatedTotal = calculateTotalAmount(subtotal, calculatedTax);
      form.setValue('tax_amount', calculatedTax);
      form.setValue('total_amount', calculatedTotal);
    }
  }, [subtotal, taxRate, form]);

  useEffect(() => {
    if (invoice) {
      form.reset({
        client_id: invoice.client_id,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax_rate: invoice.tax_rate,
        tax_amount: invoice.tax_amount,
        total_amount: invoice.total_amount,
        notes: invoice.notes,
      });
    } else {
      form.reset({
        client_id: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: null,
        status: 'draft',
        subtotal: 0,
        tax_rate: 21,
        tax_amount: 0,
        total_amount: 0,
        notes: null,
      });
    }
  }, [invoice, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      const finalDueDate = data.due_date || calculateDueDate(data.invoice_date);
      
      const { error } = await supabase.from('invoices').insert([
        {
          ...data,
          due_date: finalDueDate,
        } as any,
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Factura creada exitosamente');
      onClose();
    },
    onError: (error: any) => {
      toast.error(`Error al crear factura: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      const finalDueDate = data.due_date || calculateDueDate(data.invoice_date);
      
      const { error } = await supabase
        .from('invoices')
        .update({
          ...data,
          due_date: finalDueDate,
        } as any)
        .eq('id', invoice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Factura actualizada exitosamente');
      onClose();
    },
    onError: (error: any) => {
      toast.error(`Error al actualizar factura: ${error.message}`);
    },
  });

  // Query para cargar items de la factura (para PDF)
  const { data: invoiceItems } = useQuery({
    queryKey: ['invoice-items', invoice?.id],
    queryFn: async () => {
      if (!invoice?.id) return [];
      
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('created_at');
      
      if (error) throw error;
      return data;
    },
    enabled: isViewMode && !!invoice?.id,
  });

  const handleDownloadPDF = async () => {
    if (!invoice || !invoiceItems) {
      toast.error('No hay datos para generar el PDF');
      return;
    }

    const client = clients?.find((c) => c.id === invoice.client_id);
    if (!client) {
      toast.error('Cliente no encontrado');
      return;
    }

    try {
      await generateInvoicePDF({
        invoice,
        items: invoiceItems,
        client,
      });
      toast.success('PDF generado correctamente');
    } catch (error: any) {
      toast.error('Error al generar PDF: ' + error.message);
    }
  };

  const onSubmit = (data: InvoiceFormData) => {
    if (isViewMode) return;
    
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isNonDraftInvoice = invoice?.status && invoice.status !== 'draft';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isViewMode ? 'Detalles de Factura' : isEditMode ? 'Editar Factura' : 'Nueva Factura'}
          </DialogTitle>
        </DialogHeader>

        {isEditMode && isNonDraftInvoice && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
            ⚠️ Solo las facturas en estado "Borrador" pueden editarse
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_id">Cliente *</Label>
              <Select
                value={form.watch('client_id')}
                onValueChange={(value) => form.setValue('client_id', value)}
                disabled={isViewMode || (isEditMode && isNonDraftInvoice)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.client_id && (
                <p className="text-sm text-destructive">{form.formState.errors.client_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(value: any) => form.setValue('status', value)}
                disabled={isViewMode || (isEditMode && isNonDraftInvoice)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="sent">Enviada</SelectItem>
                  <SelectItem value="paid">Pagada</SelectItem>
                  <SelectItem value="overdue">Vencida</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_date">Fecha de Factura *</Label>
              <Input
                id="invoice_date"
                type="date"
                {...form.register('invoice_date')}
                disabled={isViewMode || (isEditMode && isNonDraftInvoice)}
              />
              {form.formState.errors.invoice_date && (
                <p className="text-sm text-destructive">{form.formState.errors.invoice_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Fecha de Vencimiento</Label>
              <Input
                id="due_date"
                type="date"
                {...form.register('due_date')}
                placeholder={invoiceDate ? calculateDueDate(invoiceDate) : ''}
                disabled={isViewMode || (isEditMode && isNonDraftInvoice)}
              />
              <p className="text-xs text-muted-foreground">
                Por defecto: +30 días desde fecha de factura
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subtotal">Subtotal (€) *</Label>
              <Input
                id="subtotal"
                type="number"
                step="0.01"
                {...form.register('subtotal')}
                disabled={isViewMode || (isEditMode && isNonDraftInvoice)}
              />
              {form.formState.errors.subtotal && (
                <p className="text-sm text-destructive">{form.formState.errors.subtotal.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_rate">Tasa de IVA (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                step="0.01"
                {...form.register('tax_rate')}
                disabled={isViewMode || (isEditMode && isNonDraftInvoice)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-muted p-4 rounded-md">
            <div className="space-y-2">
              <Label>IVA Calculado (€)</Label>
              <Input
                value={form.watch('tax_amount').toFixed(2)}
                disabled
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label>Total (€)</Label>
              <Input
                value={form.watch('total_amount').toFixed(2)}
                disabled
                className="bg-background font-semibold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              {...form.register('notes')}
              rows={3}
              disabled={isViewMode || (isEditMode && isNonDraftInvoice)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {isViewMode ? 'Cerrar' : 'Cancelar'}
            </Button>
            {isViewMode && invoice && (
              <Button type="button" variant="outline" onClick={handleDownloadPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
            )}
            {!isViewMode && (!isEditMode || !isNonDraftInvoice) && (
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending
                  ? 'Guardando...'
                  : isEditMode
                  ? 'Actualizar'
                  : 'Crear'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
