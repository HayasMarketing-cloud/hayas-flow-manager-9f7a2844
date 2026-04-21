import { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Loader2, Sparkles, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  LiquidationInvoicesList,
  LiquidationInvoiceRow,
} from './LiquidationInvoicesList';

interface SpecialistInvoiceUploadPublicProps {
  token: string;
  liquidationId: string;
  liquidationSubtotal: number;
  onUploadSuccess?: () => void;
}

interface UploadResult {
  success: boolean;
  invoiceUrl: string;
  amountsMatch: boolean | null;
  invoiceSubtotal: number | null;
  liquidationSubtotal: number;
  invoiceCount: number;
  invoicesSum: number;
  invoices: LiquidationInvoiceRow[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

export function SpecialistInvoiceUploadPublic({
  token,
  liquidationId,
  liquidationSubtotal,
  onUploadSuccess,
}: SpecialistInvoiceUploadPublicProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [invoices, setInvoices] = useState<LiquidationInvoiceRow[]>([]);

  const loadInvoices = useCallback(async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-liquidation-items`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ token, liquidation_id: liquidationId }),
        },
      );
      const data = await response.json();
      if (response.ok && Array.isArray(data.invoices)) {
        setInvoices(data.invoices);
      }
    } catch (e) {
      console.error('Error loading invoices', e);
    }
  }, [token, liquidationId]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

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

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-specialist-invoice`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              token,
              pdf_base64: base64,
              file_name: file.name,
            }),
          },
        );

        const result: UploadResult & { error?: string } = await response.json();
        if (!response.ok) throw new Error(result.error || 'Error al subir la factura');

        if (Array.isArray(result.invoices)) {
          setInvoices(result.invoices);
        } else {
          await loadInvoices();
        }

        if (result.amountsMatch === true) {
          toast.success('Importes verificados ✓', {
            description: `Suma de bases: ${formatCurrency(result.invoicesSum)}`,
          });
        } else if (result.amountsMatch === false) {
          toast.warning('La suma de las bases aún no coincide', {
            description: `Suma: ${formatCurrency(result.invoicesSum)} · Liquidación: ${formatCurrency(result.liquidationSubtotal)}`,
          });
        } else {
          toast.success('Factura subida correctamente');
        }

        onUploadSuccess?.();
      } catch (error) {
        console.error('Error uploading invoice:', error);
        toast.error(error instanceof Error ? error.message : 'Error al subir la factura');
      } finally {
        setIsUploading(false);
      }
    },
    [token, loadInvoices, onUploadSuccess],
  );

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Tus Facturas
          <Sparkles className="h-3 w-3 text-primary ml-1" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Si tu importe se factura desde varias entidades, puedes añadir varias facturas. La
          suma de las bases imponibles debe igualar el importe de la liquidación:{' '}
          <strong>{formatCurrency(liquidationSubtotal)}</strong>.
        </p>

        <LiquidationInvoicesList
          invoices={invoices}
          liquidationSubtotal={liquidationSubtotal}
          showDelete={false}
        />

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
                  Añadir otra factura
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
                    <p className="text-sm font-medium">Arrastra el PDF o haz clic</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Verificación automática con IA
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
