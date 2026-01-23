import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/invoice-utils';

const uploadSchema = z.object({
  code: z.string().min(1, 'El código es obligatorio'),
  client_id: z.string().min(1, 'El cliente es obligatorio'),
  invoice_date: z.string().min(1, 'La fecha es obligatoria'),
  due_date: z.string().optional(),
  subtotal: z.number().min(0, 'El subtotal debe ser positivo'),
  tax_rate: z.number().min(0).max(100),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  notes: z.string().optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

interface InvoiceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InvoiceUploadModal({ isOpen, onClose }: InvoiceUploadModalProps) {
  const queryClient = useQueryClient();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      tax_rate: 21,
      invoice_date: new Date().toISOString().split('T')[0],
      status: 'sent',
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('name');
      return data || [];
    },
  });

  const subtotal = watch('subtotal') || 0;
  const taxRate = watch('tax_rate') || 21;
  const taxAmount = (subtotal * taxRate) / 100;
  const totalAmount = subtotal + taxAmount;

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadFormData) => {
      setUploading(true);
      
      // Create invoice record
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          code: data.code,
          client_id: data.client_id,
          invoice_date: data.invoice_date,
          due_date: data.due_date || null,
          tax_rate: data.tax_rate,
          subtotal: data.subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          notes: data.notes || null,
          status: data.status,
          sent_at: data.status === 'sent' || data.status === 'paid' || data.status === 'overdue' 
            ? new Date().toISOString() 
            : null,
          paid_at: data.status === 'paid' ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Upload PDF if provided
      if (pdfFile && newInvoice) {
        const filePath = `${newInvoice.id}/${pdfFile.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('invoice-files')
          .upload(filePath, pdfFile, { upsert: true });

        if (uploadError) {
          console.error('Error uploading PDF:', uploadError);
          toast.error('Error al subir el PDF, pero la factura fue creada');
        } else {
          const { data: urlData } = supabase.storage
            .from('invoice-files')
            .getPublicUrl(filePath);

          await supabase
            .from('invoices')
            .update({ pdf_url: urlData.publicUrl })
            .eq('id', newInvoice.id);
        }
      }

      return newInvoice;
    },
    onSuccess: () => {
      toast.success('Factura importada correctamente');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      reset();
      setPdfFile(null);
      onClose();
    },
    onError: (error) => {
      console.error('Error uploading invoice:', error);
      toast.error('Error al importar la factura');
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Solo se permiten archivos PDF');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('El archivo no puede superar 10MB');
        return;
      }
      setPdfFile(file);
    }
  };

  const onSubmit = (data: UploadFormData) => {
    uploadMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Factura Emitida</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código de Factura *</Label>
              <Input
                {...register('code')}
                placeholder="Ej: FAC-2024-001"
              />
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select
                value={watch('client_id')}
                onValueChange={(value) => setValue('client_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.client_id && (
                <p className="text-sm text-destructive">{errors.client_id.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de Factura *</Label>
              <Input type="date" {...register('invoice_date')} />
              {errors.invoice_date && (
                <p className="text-sm text-destructive">{errors.invoice_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Fecha de Vencimiento</Label>
              <Input type="date" {...register('due_date')} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Subtotal (sin IVA) *</Label>
              <Input
                type="number"
                step="0.01"
                {...register('subtotal', { valueAsNumber: true })}
                placeholder="0.00"
              />
              {errors.subtotal && (
                <p className="text-sm text-destructive">{errors.subtotal.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>% IVA</Label>
              <Input
                type="number"
                step="1"
                {...register('tax_rate', { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={watch('status')}
                onValueChange={(value: any) => setValue('status', value)}
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

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>IVA ({taxRate}%):</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Copia de la Factura (PDF)</Label>
            <div className="border-2 border-dashed rounded-lg p-4">
              {pdfFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm">{pdfFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(pdfFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPdfFile(null)}
                  >
                    Eliminar
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center cursor-pointer">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Arrastra un PDF o haz clic para seleccionar
                  </span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              {...register('notes')}
              placeholder="Observaciones adicionales..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importar Factura
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
