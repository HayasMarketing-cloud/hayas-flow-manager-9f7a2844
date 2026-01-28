import { useState, useCallback } from 'react';
import { Upload, FileText, Trash2, ExternalLink, Loader2, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/liquidation-utils';
import { Database } from '@/integrations/supabase/types';

type LiquidationStatus = Database['public']['Enums']['liquidation_status'];

interface SpecialistInvoiceUploadProps {
  liquidationId: string;
  liquidationCode: string;
  currentInvoiceUrl: string | null;
  currentStatus: LiquidationStatus;
  liquidationSubtotal: number;
  onUploadSuccess: () => void;
}

interface ExtractedData {
  invoice_number: string;
  invoice_date: string | null;
  period_month: number | null;
  period_year: number | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  irpf_rate: number | null;
  irpf_amount: number | null;
  total_amount: number;
  specialist_name: string | null;
}

export function SpecialistInvoiceUpload({
  liquidationId,
  liquidationCode,
  currentInvoiceUrl,
  currentStatus,
  liquidationSubtotal,
  onUploadSuccess,
}: SpecialistInvoiceUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [amountMismatch, setAmountMismatch] = useState<{ invoiceAmount: number; liquidationAmount: number } | null>(null);

  const canUpload = ['draft', 'validated', 'sent', 'accepted', 'invoice_received', 'pending_payment'].includes(currentStatus);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.includes('pdf')) {
      toast.error('Solo se permiten archivos PDF');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo no puede superar 10MB');
      return;
    }

    setIsUploading(true);
    setExtractedData(null);
    setAmountMismatch(null);

    try {
      // Convert to base64 for AI extraction
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Call AI extraction to verify amounts
      const { data: aiData, error: aiError } = await supabase.functions.invoke('extract-specialist-invoice-data', {
        body: { pdf_base64: base64 },
      });

      let invoiceSubtotal: number | null = null;
      
      if (!aiError && aiData && !aiData.error) {
        setExtractedData(aiData);
        invoiceSubtotal = aiData.subtotal;
        
        // Check if amounts match (±1€ tolerance)
        const amountsMatch = Math.abs(aiData.subtotal - liquidationSubtotal) <= 1;
        
        if (!amountsMatch) {
          setAmountMismatch({
            invoiceAmount: aiData.subtotal,
            liquidationAmount: liquidationSubtotal,
          });
        }
      } else {
        console.warn('AI extraction failed, proceeding without verification:', aiError || aiData?.error);
        toast.warning('No se pudo verificar el importe automáticamente');
      }

      // Proceed with upload
      const filePath = `${liquidationId}/factura-especialista.pdf`;

      // Delete existing file if present
      if (currentInvoiceUrl) {
        await supabase.storage
          .from('liquidation-invoices')
          .remove([filePath]);
      }

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from('liquidation-invoices')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL with cache buster
      const { data: publicUrlData } = supabase.storage
        .from('liquidation-invoices')
        .getPublicUrl(filePath);

      // Update liquidation with URL and new status
      const updateData: { specialist_invoice_url: string; status?: LiquidationStatus } = {
        specialist_invoice_url: `${publicUrlData.publicUrl}?t=${Date.now()}`,
      };

      // Change status to invoice_received if in early states
      if (['draft', 'validated', 'sent', 'accepted'].includes(currentStatus)) {
        updateData.status = 'invoice_received';
      }

      const { error: updateError } = await supabase
        .from('liquidations')
        .update(updateData)
        .eq('id', liquidationId);

      if (updateError) throw updateError;

      // Show appropriate toast based on amount verification
      if (invoiceSubtotal !== null) {
        const amountsMatch = Math.abs(invoiceSubtotal - liquidationSubtotal) <= 1;
        if (amountsMatch) {
          toast.success('Factura subida correctamente - Importes verificados ✓', {
            description: `Base imponible: ${formatCurrency(invoiceSubtotal)}`,
          });
        } else {
          toast.warning('Factura subida - Los importes no coinciden', {
            description: `Factura: ${formatCurrency(invoiceSubtotal)} vs Liquidación: ${formatCurrency(liquidationSubtotal)}`,
          });
        }
      } else {
        toast.success('Factura subida correctamente');
      }
      
      onUploadSuccess();
    } catch (error) {
      console.error('Error uploading invoice:', error);
      toast.error('Error al subir la factura');
    } finally {
      setIsUploading(false);
    }
  }, [liquidationId, currentInvoiceUrl, currentStatus, liquidationSubtotal, onUploadSuccess]);

  const handleDelete = async () => {
    if (!currentInvoiceUrl) return;

    setIsDeleting(true);
    try {
      const filePath = `${liquidationId}/factura-especialista.pdf`;

      const { error: deleteError } = await supabase.storage
        .from('liquidation-invoices')
        .remove([filePath]);

      if (deleteError) throw deleteError;

      const { error: updateError } = await supabase
        .from('liquidations')
        .update({ specialist_invoice_url: null })
        .eq('id', liquidationId);

      if (updateError) throw updateError;

      setExtractedData(null);
      setAmountMismatch(null);
      toast.success('Factura eliminada');
      onUploadSuccess();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Error al eliminar la factura');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleUpload(file);
    }
  }, [handleUpload]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    e.target.value = '';
  };

  // Add cache buster to URL for viewing
  const invoiceViewUrl = currentInvoiceUrl 
    ? (currentInvoiceUrl.includes('?') ? currentInvoiceUrl : `${currentInvoiceUrl}?t=${Date.now()}`)
    : null;

  if (!canUpload) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Factura del Especialista
          <Sparkles className="h-3 w-3 text-primary ml-1" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentInvoiceUrl ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-cyan-500" />
                <div>
                  <p className="text-sm font-medium">factura-especialista.pdf</p>
                  <p className="text-xs text-muted-foreground">
                    Factura de {liquidationCode}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a href={invoiceViewUrl || '#'} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ver
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-destructive hover:text-destructive"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
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
                    <Upload className="h-4 w-4 mr-2" />
                    Reemplazar factura
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                "relative border-2 border-dashed rounded-lg p-6 transition-colors",
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
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
                    <div>
                      <p className="text-sm font-medium">Procesando factura con IA...</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Extrayendo datos y verificando importes
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <Upload className={cn(
                        "h-8 w-8",
                        isDragOver ? "text-primary" : "text-muted-foreground"
                      )} />
                      <Sparkles className="h-3 w-3 text-primary absolute -top-1 -right-1" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        Arrastra el PDF o haz clic para seleccionar
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Verificación automática de importes con IA
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {amountMismatch && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Los importes no coinciden: Factura {formatCurrency(amountMismatch.invoiceAmount)} vs Liquidación {formatCurrency(amountMismatch.liquidationAmount)}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
