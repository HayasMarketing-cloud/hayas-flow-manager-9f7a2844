import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, Sparkles, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SpecialistInvoiceUploadPublicProps {
  token: string;
  liquidationSubtotal: number;
  currentInvoiceUrl: string | null;
  onUploadSuccess: (result: UploadResult) => void;
}

interface UploadResult {
  success: boolean;
  invoiceUrl: string;
  amountsMatch: boolean | null;
  invoiceSubtotal: number | null;
  liquidationSubtotal: number;
  digitalEvidence: {
    uploadedAt: string;
    ipAddress: string;
  };
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

export function SpecialistInvoiceUploadPublic({
  token,
  liquidationSubtotal,
  currentInvoiceUrl,
  onUploadSuccess,
}: SpecialistInvoiceUploadPublicProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

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
    setUploadResult(null);

    try {
      // Convert to base64
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

      // Call secure edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-specialist-invoice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ token, pdf_base64: base64 }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al subir la factura');
      }

      setUploadResult(result);
      onUploadSuccess(result);

      // Show appropriate toast
      if (result.amountsMatch === true) {
        toast.success('Factura verificada correctamente', {
          description: `Base imponible coincide: ${formatCurrency(result.invoiceSubtotal)}`,
        });
      } else if (result.amountsMatch === false) {
        toast.warning('Factura subida - Los importes no coinciden', {
          description: `Factura: ${formatCurrency(result.invoiceSubtotal)} vs Liquidación: ${formatCurrency(result.liquidationSubtotal)}`,
        });
      } else {
        toast.success('Factura subida correctamente');
      }
    } catch (error) {
      console.error('Error uploading invoice:', error);
      toast.error(error instanceof Error ? error.message : 'Error al subir la factura');
    } finally {
      setIsUploading(false);
    }
  }, [token, onUploadSuccess]);

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

  // Get view URL with cache buster
  const viewUrl = uploadResult?.invoiceUrl || currentInvoiceUrl;
  const invoiceViewUrl = viewUrl 
    ? (viewUrl.includes('?') ? viewUrl : `${viewUrl}?t=${Date.now()}`)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Tu Factura
          <Sparkles className="h-3 w-3 text-primary ml-1" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Already uploaded or upload result */}
        {(uploadResult || currentInvoiceUrl) ? (
          <div className="space-y-3">
            {/* Verification result */}
            {uploadResult && (
              <div className={cn(
                "rounded-lg p-3 flex items-start gap-3",
                uploadResult.amountsMatch === true 
                  ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900"
                  : uploadResult.amountsMatch === false
                    ? "bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900"
                    : "bg-muted border"
              )}>
                {uploadResult.amountsMatch === true ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                ) : uploadResult.amountsMatch === false ? (
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                ) : (
                  <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                )}
                <div className="flex-1 text-sm">
                  <p className="font-medium">
                    {uploadResult.amountsMatch === true 
                      ? 'Importes verificados ✓'
                      : uploadResult.amountsMatch === false
                        ? 'Discrepancia de importes'
                        : 'Factura subida'}
                  </p>
                  {uploadResult.invoiceSubtotal !== null && (
                    <div className="text-muted-foreground mt-1 space-y-0.5">
                      <p>Factura: {formatCurrency(uploadResult.invoiceSubtotal)}</p>
                      <p>Liquidación: {formatCurrency(uploadResult.liquidationSubtotal)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* View uploaded file */}
            {invoiceViewUrl && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-cyan-500" />
                  <div>
                    <p className="text-sm font-medium">factura-especialista.pdf</p>
                    <p className="text-xs text-muted-foreground">Tu factura subida</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={invoiceViewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ver
                  </a>
                </Button>
              </div>
            )}

            {/* Replace option */}
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
          /* Initial upload state */
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sube tu factura para verificación automática de importes (opcional).
            </p>
            
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
                        Arrastra el PDF o haz clic
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Verificación automática con IA
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Info */}
            <p className="text-xs text-muted-foreground">
              La base imponible de tu factura debe coincidir con el subtotal de la liquidación: <strong>{formatCurrency(liquidationSubtotal)}</strong>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
