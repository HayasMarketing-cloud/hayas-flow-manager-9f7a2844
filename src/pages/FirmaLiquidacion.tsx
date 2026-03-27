import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { notificationFeedback } from '@/lib/notification-feedback';
import { 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Calendar, 
  Euro, 
  User,
  Shield,
  Clock,
  AlertTriangle,
  Loader2,
  Download
} from 'lucide-react';
import { generateLiquidationPDF } from '@/utils/pdf/liquidationPDFGenerator';
import { SpecialistInvoiceUploadPublic } from '@/components/liquidations/SpecialistInvoiceUploadPublic';

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

export default function FirmaLiquidacion() {
  const { token } = useParams<{ token: string }>();
  const [action, setAction] = useState<'accept' | 'dispute' | null>(null);
  const [comments, setComments] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [invoiceUploaded, setInvoiceUploaded] = useState(false);

  // Fetch signature and liquidation data via secure edge function
  const { data: signatureData, isLoading, error } = useQuery({
    queryKey: ['signature', token],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-signature-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ token }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Token not found');
      }

      return await response.json();
    },
    enabled: !!token,
  });

  // Fetch liquidation items via secure edge function
  const { data: itemsData } = useQuery({
    queryKey: ['liquidation-items', signatureData?.liquidation?.id, token],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-liquidation-items`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ 
            token, 
            liquidation_id: signatureData!.liquidation.id 
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error fetching items');
      }

      const result = await response.json();
      // Handle both old format (array) and new format (object with items + commissionDetails)
      if (Array.isArray(result)) {
        return { items: result, commissionDetails: {} };
      }
      return result as { items: any[]; commissionDetails: Record<string, any> };
    },
    enabled: !!signatureData?.liquidation?.id && !!token,
  });

  const items = itemsData?.items;
  const commissionDetails = itemsData?.commissionDetails || {};

  const processMutation = useMutation({
    mutationFn: async (data: { action: 'accept' | 'dispute'; comments?: string; disputeReason?: string }) => {
      const { data: result, error } = await supabase.functions.invoke('process-signature', {
        body: {
          token,
          action: data.action,
          comments: data.comments,
          disputeReason: data.disputeReason,
        },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      toast.success(result.message);
      // Show notification feedback - notifications sent to management team
      notificationFeedback.liquidationSigned(action === 'accept' ? 'accepted' : 'disputed');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al procesar la firma');
    },
  });

  const handleDownloadPDF = async () => {
    if (!signatureData?.liquidation || !items) return;
    
    setIsDownloading(true);
    try {
      await generateLiquidationPDF({
        liquidation: signatureData.liquidation,
        items,
        specialist: signatureData.liquidation.specialist,
        commissionDetails: commissionDetails || undefined,
      });
      toast.success('PDF descargado correctamente');
    } catch (error) {
      toast.error('Error al descargar el PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubmit = () => {
    if (!action) return;
    
    if (action === 'dispute' && !disputeReason.trim()) {
      toast.error('Por favor, indica el motivo de la disputa');
      return;
    }

    processMutation.mutate({
      action,
      comments: comments.trim() || undefined,
      disputeReason: action === 'dispute' ? disputeReason.trim() : undefined,
    });
  };

  // Check various states
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Cargando liquidación...</p>
        </div>
      </div>
    );
  }

  if (error || !signatureData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Enlace no válido</h2>
            <p className="text-muted-foreground">
              Este enlace de firma no existe o ha sido eliminado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = new Date(signatureData.expires_at) < new Date();
  const isAlreadyProcessed = signatureData.status !== 'pending';
  const liquidation = signatureData.liquidation;
  const periodName = `${monthNames[(liquidation?.period_month || 1) - 1]} ${liquidation?.period_year}`;
  const totalAmount = items?.reduce((sum, item) => sum + Number(item.total), 0) || liquidation?.subtotal || 0;

  // Already processed
  if (isAlreadyProcessed || processMutation.isSuccess) {
    const status = processMutation.data ? (action === 'accept' ? 'accepted' : 'disputed') : signatureData.status;
    const evidence = processMutation.data?.digitalEvidence || {
      signedAt: signatureData.signed_at,
      ipAddress: signatureData.ip_address,
    };

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 text-center space-y-6">
            {status === 'accepted' ? (
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            ) : (
              <XCircle className="h-16 w-16 text-orange-500 mx-auto" />
            )}
            
            <div>
              <h2 className="text-2xl font-semibold mb-2">
                {status === 'accepted' ? 'Liquidación Aceptada' : 'Disputa Registrada'}
              </h2>
              <p className="text-muted-foreground">
                {status === 'accepted' 
                  ? 'Has confirmado la liquidación correctamente.' 
                  : 'Tu disputa ha sido registrada. Te contactaremos pronto.'}
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4 text-left space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Evidencia Digital
              </h3>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>Fecha: {new Date(evidence.signedAt).toLocaleString('es-ES')}</p>
                <p>IP: {evidence.ipAddress}</p>
                <p>Acción: {status === 'accepted' ? 'Aceptada' : 'Disputada'}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Esta información queda registrada como prueba digital de tu decisión.
            </p>

            {/* Invoice upload - only after accepting */}
            {status === 'accepted' && (
              <div className="w-full text-left">
                <SpecialistInvoiceUploadPublic
                  token={token || ''}
                  liquidationSubtotal={liquidation?.subtotal || totalAmount}
                  currentInvoiceUrl={null}
                  onUploadSuccess={(result) => {
                    setInvoiceUploaded(true);
                    console.log('Invoice uploaded:', result);
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired
  if (isExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <Clock className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Enlace expirado</h2>
            <p className="text-muted-foreground">
              Este enlace de firma ha expirado. Por favor, contacta con administración para solicitar un nuevo enlace.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Firma Digital de Liquidación</h1>
          <p className="text-muted-foreground">
            Revisa los detalles y confirma o disputa la liquidación
          </p>
        </div>

        {/* Liquidation Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {liquidation?.code}
            </CardTitle>
            <CardDescription>Detalles de la liquidación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Especialista:</span>
              </div>
              <span className="font-medium">{liquidation?.specialist?.name}</span>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Período:</span>
              </div>
              <span className="font-medium">{periodName}</span>

              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total:</span>
              </div>
              <span className="font-bold text-lg text-primary">{formatCurrency(totalAmount)}</span>
            </div>

            <Separator />

            {/* Items list */}
            <div className="space-y-2">
              <h4 className="font-medium">Detalle de servicios:</h4>
              <div className="bg-muted rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                {items && items.length > 0 ? (
                  items.map((item) => {
                    // Determinar cantidad a mostrar: hours si es hourly, quantity del request si es fixed
                    const displayQuantity = item.financial_request?.cost_type === 'hourly'
                      ? (item.financial_request?.hours || item.quantity || 1)
                      : (item.financial_request?.quantity || item.quantity || 1);
                    return (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="truncate flex-1">
                          {item.description}
                          {item.financial_request?.client?.name && (
                            <span className="text-muted-foreground ml-1">
                              ({item.financial_request.client.name})
                            </span>
                          )}
                          <span className="text-muted-foreground ml-1">
                            x{displayQuantity}
                          </span>
                        </span>
                        <span className="font-medium ml-4">{formatCurrency(item.total)}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted-foreground text-sm">Sin items</p>
                )}
              </div>
            </div>

            {/* Download PDF */}
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleDownloadPDF}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Descargar PDF
            </Button>
          </CardContent>
        </Card>

        {/* Action Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Tu decisión</CardTitle>
            <CardDescription>
              Selecciona una opción para completar el proceso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Accept/Dispute buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={action === 'accept' ? 'default' : 'outline'}
                className={`h-auto py-4 flex-col gap-2 ${action === 'accept' ? 'ring-2 ring-green-500' : ''}`}
                onClick={() => setAction('accept')}
              >
                <CheckCircle2 className={`h-8 w-8 ${action === 'accept' ? 'text-white' : 'text-green-500'}`} />
                <span className="font-semibold">Aceptar</span>
                <span className="text-xs opacity-80">Confirmo que es correcto</span>
              </Button>

              <Button
                variant={action === 'dispute' ? 'default' : 'outline'}
                className={`h-auto py-4 flex-col gap-2 ${action === 'dispute' ? 'ring-2 ring-orange-500 bg-orange-500 hover:bg-orange-600' : ''}`}
                onClick={() => setAction('dispute')}
              >
                <XCircle className={`h-8 w-8 ${action === 'dispute' ? 'text-white' : 'text-orange-500'}`} />
                <span className="font-semibold">Disputar</span>
                <span className="text-xs opacity-80">Hay un error o discrepancia</span>
              </Button>
            </div>

            {/* Dispute reason (required for dispute) */}
            {action === 'dispute' && (
              <div className="space-y-2">
                <Label htmlFor="disputeReason" className="flex items-center gap-1">
                  Motivo de la disputa <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="disputeReason"
                  placeholder="Explica el motivo de la disputa..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* Optional comments */}
            {action && (
              <div className="space-y-2">
                <Label htmlFor="comments">Comentarios adicionales (opcional)</Label>
                <Textarea
                  id="comments"
                  placeholder="Añade cualquier comentario..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={2}
                />
              </div>
            )}

            {/* Submit button */}
            {action && (
              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={processMutation.isPending}
              >
                {processMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : action === 'accept' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar Aceptación
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Enviar Disputa
                  </>
                )}
              </Button>
            )}

            {/* Legal notice */}
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1 mb-1">
                <Shield className="h-3 w-3" />
                <strong>Aviso legal</strong>
              </p>
              <p>
                Al hacer clic en "Confirmar" se registrará tu dirección IP, fecha y hora como evidencia digital de tu decisión. 
                Esta información tiene validez legal como prueba de aceptación o disputa.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
