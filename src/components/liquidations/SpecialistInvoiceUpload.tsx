import { useState, useCallback } from 'react';
import { Upload, FileText, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';

type LiquidationStatus = Database['public']['Enums']['liquidation_status'];

interface SpecialistInvoiceUploadProps {
  liquidationId: string;
  liquidationCode: string;
  currentInvoiceUrl: string | null;
  currentStatus: LiquidationStatus;
  onUploadSuccess: () => void;
}

export function SpecialistInvoiceUpload({
  liquidationId,
  liquidationCode,
  currentInvoiceUrl,
  currentStatus,
  onUploadSuccess,
}: SpecialistInvoiceUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

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
    try {
      const filePath = `${liquidationId}/factura-especialista.pdf`;

      // Si ya existe un archivo, eliminarlo primero
      if (currentInvoiceUrl) {
        await supabase.storage
          .from('liquidation-invoices')
          .remove([filePath]);
      }

      // Subir nuevo archivo
      const { error: uploadError } = await supabase.storage
        .from('liquidation-invoices')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: publicUrlData } = supabase.storage
        .from('liquidation-invoices')
        .getPublicUrl(filePath);

      // Actualizar liquidación con URL y nuevo estado
      const updateData: { specialist_invoice_url: string; status?: LiquidationStatus } = {
        specialist_invoice_url: publicUrlData.publicUrl,
      };

      // Cambiar estado a invoice_received si está en cualquier estado previo
      if (['draft', 'validated', 'sent', 'accepted'].includes(currentStatus)) {
        updateData.status = 'invoice_received';
      }

      const { error: updateError } = await supabase
        .from('liquidations')
        .update(updateData)
        .eq('id', liquidationId);

      if (updateError) throw updateError;

      toast.success('Factura subida correctamente');
      onUploadSuccess();
    } catch (error) {
      console.error('Error uploading invoice:', error);
      toast.error('Error al subir la factura');
    } finally {
      setIsUploading(false);
    }
  }, [liquidationId, currentInvoiceUrl, currentStatus, onUploadSuccess]);

  const handleDelete = async () => {
    if (!currentInvoiceUrl) return;

    setIsDeleting(true);
    try {
      const filePath = `${liquidationId}/factura-especialista.pdf`;

      const { error: deleteError } = await supabase.storage
        .from('liquidation-invoices')
        .remove([filePath]);

      if (deleteError) throw deleteError;

      // Actualizar liquidación para quitar URL (no cambiamos el estado)
      const { error: updateError } = await supabase
        .from('liquidations')
        .update({ specialist_invoice_url: null })
        .eq('id', liquidationId);

      if (updateError) throw updateError;

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

  if (!canUpload) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Factura del Especialista
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
                  <a href={currentInvoiceUrl} target="_blank" rel="noopener noreferrer">
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
                    Subiendo...
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
                  <p className="text-sm font-medium">Subiendo factura...</p>
                </>
              ) : (
                <>
                  <Upload className={cn(
                    "h-8 w-8",
                    isDragOver ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div>
                    <p className="text-sm font-medium">
                      Arrastra el PDF o haz clic para seleccionar
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Solo archivos PDF (máx. 10MB)
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
