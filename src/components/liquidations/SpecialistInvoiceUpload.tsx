import { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Loader2, Sparkles, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { notifySpecialistInvoiceUploaded } from '@/lib/notification-utils';
import { Database } from '@/integrations/supabase/types';
import {
  LiquidationInvoicesList,
  LiquidationInvoiceRow,
} from './LiquidationInvoicesList';

type LiquidationStatus = Database['public']['Enums']['liquidation_status'];

interface SpecialistInvoiceUploadProps {
  liquidationId: string;
  liquidationCode: string;
  specialistName: string;
  currentInvoiceUrl: string | null;
  currentStatus: LiquidationStatus;
  liquidationSubtotal: number;
  onUploadSuccess: () => void;
}

interface ExtractedData {
  invoice_number: string;
  invoice_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  irpf_rate: number | null;
  irpf_amount: number | null;
  total_amount: number;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export function SpecialistInvoiceUpload({
  liquidationId,
  liquidationCode,
  specialistName,
  currentStatus,
  liquidationSubtotal,
  onUploadSuccess,
}: SpecialistInvoiceUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [invoices, setInvoices] = useState<LiquidationInvoiceRow[]>([]);

  const canUpload = !['paid'].includes(currentStatus);

  const loadInvoices = useCallback(async () => {
    const { data, error } = await supabase
      .from('liquidation_invoices')
      .select('id, file_url, file_name, invoice_number, invoice_date, subtotal, total_amount, uploaded_at')
      .eq('liquidation_id', liquidationId)
      .order('uploaded_at', { ascending: true });
    if (!error && data) setInvoices(data as LiquidationInvoiceRow[]);
  }, [liquidationId]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const recomputeStatus = useCallback(
    async (allInvoices: LiquidationInvoiceRow[]) => {
      const sum = allInvoices.reduce(
        (acc, i) => acc + (Number(i.subtotal) || 0),
        0,
      );
      const matches = Math.abs(sum - liquidationSubtotal) <= 1;
      let newStatus: LiquidationStatus | null = null;

      if (allInvoices.length === 0) {
        // No invoices left → revert to accepted if was further along
        if (['invoice_received', 'pending_payment'].includes(currentStatus)) {
          newStatus = 'accepted';
        }
      } else if (matches && ['accepted', 'invoice_received'].includes(currentStatus)) {
        newStatus = 'pending_payment';
      } else if (!matches && currentStatus === 'pending_payment') {
        newStatus = 'invoice_received';
      } else if (!matches && currentStatus === 'accepted') {
        newStatus = 'invoice_received';
      }

      const lastUrl = allInvoices[allInvoices.length - 1]?.file_url ?? null;
      const update: { specialist_invoice_url: string | null; status?: LiquidationStatus } =
        { specialist_invoice_url: lastUrl };
      if (newStatus) update.status = newStatus;

      await supabase.from('liquidations').update(update).eq('id', liquidationId);
    },
    [currentStatus, liquidationId, liquidationSubtotal],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.type.includes('pdf')) {
        toast.error('Solo se permiten archivos PDF');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('El archivo no puede superar 10MB');
        return;
      }

      setIsUploading(true);
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // AI extraction (best-effort)
        let extracted: ExtractedData | null = null;
        try {
          const { data: aiData, error: aiError } = await supabase.functions.invoke(
            'extract-specialist-invoice-data',
            { body: { pdf_base64: base64 } },
          );
          if (!aiError && aiData && !aiData.error) {
            extracted = aiData;
          }
        } catch (e) {
          console.warn('AI extraction failed', e);
        }

        // Generate unique storage path
        const invoiceId = crypto.randomUUID();
        const safeName = slug(file.name) || 'factura.pdf';
        const filePath = `${liquidationId}/${invoiceId}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('liquidation-invoices')
          .upload(filePath, file, { upsert: false, contentType: 'application/pdf' });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('liquidation-invoices')
          .getPublicUrl(filePath);
        const fileUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

        const { data: inserted, error: insertError } = await supabase
          .from('liquidation_invoices')
          .insert({
            id: invoiceId,
            liquidation_id: liquidationId,
            file_url: fileUrl,
            file_name: file.name,
            storage_path: filePath,
            invoice_number: extracted?.invoice_number || null,
            invoice_date: extracted?.invoice_date || null,
            subtotal: extracted?.subtotal ?? null,
            tax_amount: extracted?.tax_amount ?? null,
            irpf_amount: extracted?.irpf_amount ?? null,
            total_amount: extracted?.total_amount ?? null,
            ai_extracted: extracted as any,
          })
          .select('id, file_url, file_name, invoice_number, invoice_date, subtotal, total_amount, uploaded_at')
          .single();

        if (insertError) throw insertError;

        const newList = [...invoices, inserted as LiquidationInvoiceRow];
        setInvoices(newList);
        await recomputeStatus(newList);

        const sum = newList.reduce((a, i) => a + (Number(i.subtotal) || 0), 0);
        const matches = Math.abs(sum - liquidationSubtotal) <= 1;
        toast.success(`Factura ${newList.length} añadida`, {
          description: matches ? 'Importes verificados ✓' : 'Suma aún no cuadra con el subtotal',
        });

        notifySpecialistInvoiceUploaded(
          liquidationCode,
          liquidationId,
          specialistName,
          matches,
          newList.length,
          sum,
          liquidationSubtotal,
        );

        onUploadSuccess();
      } catch (error) {
        console.error('Error uploading invoice:', error);
        toast.error('Error al subir la factura');
      } finally {
        setIsUploading(false);
      }
    },
    [
      invoices,
      liquidationCode,
      liquidationId,
      liquidationSubtotal,
      onUploadSuccess,
      recomputeStatus,
      specialistName,
    ],
  );

  const handleDelete = async (invoiceId: string) => {
    setDeletingId(invoiceId);
    try {
      const target = invoices.find((i) => i.id === invoiceId);
      const { data: row } = await supabase
        .from('liquidation_invoices')
        .select('storage_path')
        .eq('id', invoiceId)
        .single();
      if (row?.storage_path) {
        await supabase.storage.from('liquidation-invoices').remove([row.storage_path]);
      }
      const { error } = await supabase
        .from('liquidation_invoices')
        .delete()
        .eq('id', invoiceId);
      if (error) throw error;

      const newList = invoices.filter((i) => i.id !== invoiceId);
      setInvoices(newList);
      await recomputeStatus(newList);

      toast.success('Factura eliminada');
      onUploadSuccess();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Error al eliminar la factura');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  if (!canUpload && invoices.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Facturas del Especialista
          <Sparkles className="h-3 w-3 text-primary ml-1" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <LiquidationInvoicesList
          invoices={invoices}
          liquidationSubtotal={liquidationSubtotal}
          onDelete={canUpload ? handleDelete : undefined}
          deletingId={deletingId}
          showDelete={canUpload}
        />

        {canUpload && (
          <>
            {invoices.length > 0 ? (
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                <Button variant="outline" className="w-full" disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Procesando con IA...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Añadir factura
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                className={cn(
                  'relative border-2 border-dashed rounded-lg p-6 transition-colors',
                  isDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50',
                )}
              >
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                <div className="flex flex-col items-center gap-2 text-center">
                  {isUploading ? (
                    <>
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                      <p className="text-sm font-medium">Procesando factura con IA...</p>
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <Upload
                          className={cn(
                            'h-8 w-8',
                            isDragOver ? 'text-primary' : 'text-muted-foreground',
                          )}
                        />
                        <Sparkles className="h-3 w-3 text-primary absolute -top-1 -right-1" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          Arrastra el PDF o haz clic para seleccionar
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Puedes subir varias facturas si es necesario
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
