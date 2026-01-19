import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Calendar, 
  Euro, 
  User,
  Building,
  Shield,
  Clock,
  AlertTriangle,
  Loader2
} from 'lucide-react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
};

export default function AccionRequest() {
  const { token } = useParams<{ token: string }>();
  const [action, setAction] = useState<'accept' | 'reject' | null>(null);
  const [comments, setComments] = useState('');

  // Fetch and validate token
  const { data: tokenData, isLoading, error } = useQuery({
    queryKey: ['request-action-token', token],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-request-action-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ token }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al validar el token');
      }

      return data;
    },
    enabled: !!token,
  });

  // Process action mutation
  const processMutation = useMutation({
    mutationFn: async (data: { action: 'accept' | 'reject'; comments?: string }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-request-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            token,
            action: data.action,
            comments: data.comments,
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error al procesar la acción');
      }

      return result;
    },
    onSuccess: (result) => {
      toast.success(result.message);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al procesar la acción');
    },
  });

  const handleSubmit = () => {
    if (!action) return;
    
    if (action === 'reject' && !comments.trim()) {
      toast.error('Por favor, indica el motivo del rechazo');
      return;
    }

    processMutation.mutate({
      action,
      comments: comments.trim() || undefined,
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Verificando enlace...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !tokenData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Enlace no válido</h2>
            <p className="text-muted-foreground">
              {(error as Error)?.message || 'Este enlace de acción no existe o ha sido eliminado.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const request = tokenData.request;
  const isExpired = new Date(tokenData.expires_at) < new Date();

  // Expired state
  if (isExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <Clock className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Enlace expirado</h2>
            <p className="text-muted-foreground">
              Este enlace ha expirado. Por favor, contacta con el equipo de gestión para solicitar uno nuevo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (processMutation.isSuccess) {
    const evidence = processMutation.data?.digitalEvidence;
    const isAccepted = action === 'accept';

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 text-center space-y-6">
            {isAccepted ? (
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            ) : (
              <XCircle className="h-16 w-16 text-orange-500 mx-auto" />
            )}
            
            <div>
              <h2 className="text-2xl font-semibold mb-2">
                {isAccepted ? 'Trabajo Aceptado' : 'Trabajo Rechazado'}
              </h2>
              <p className="text-muted-foreground">
                {isAccepted 
                  ? 'Has confirmado que puedes realizar este trabajo. Te notificaremos cuando sea aprobado para comenzar.' 
                  : 'Has indicado que no puedes realizar este trabajo. El equipo de gestión buscará otro especialista.'}
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4 text-left space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Evidencia Digital
              </h3>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>Fecha: {new Date(evidence?.actionedAt).toLocaleString('es-ES')}</p>
                <p>IP: {evidence?.ipAddress}</p>
                <p>Request: {evidence?.requestCode}</p>
                <p>Acción: {isAccepted ? 'Aceptado' : 'Rechazado'}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Esta información queda registrada como prueba digital de tu decisión.
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
          <h1 className="text-3xl font-bold">Confirmación de Trabajo</h1>
          <p className="text-muted-foreground">
            Revisa los detalles y confirma si puedes realizar este trabajo
          </p>
        </div>

        {/* Request Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {request.code}
            </CardTitle>
            <CardDescription>{request.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cliente:</span>
              </div>
              <span className="font-medium">{request.client?.name || '-'}</span>

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Servicio:</span>
              </div>
              <span className="font-medium">{request.service?.name || '-'}</span>

              {request.deadline && (
                <>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Fecha límite:</span>
                  </div>
                  <span className="font-medium">{formatDate(request.deadline)}</span>
                </>
              )}

              {request.cost_to_agency && (
                <>
                  <div className="flex items-center gap-2">
                    <Euro className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Importe:</span>
                  </div>
                  <span className="font-bold text-lg text-primary">
                    {formatCurrency(request.cost_to_agency)}
                  </span>
                </>
              )}
            </div>

            {request.description && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Descripción:</h4>
                  <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
                    {request.description}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Action Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Tu decisión</CardTitle>
            <CardDescription>
              ¿Puedes realizar este trabajo?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Accept/Reject buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={action === 'accept' ? 'default' : 'outline'}
                className={`h-auto py-4 flex-col gap-2 ${action === 'accept' ? 'ring-2 ring-green-500' : ''}`}
                onClick={() => setAction('accept')}
              >
                <CheckCircle2 className={`h-8 w-8 ${action === 'accept' ? 'text-white' : 'text-green-500'}`} />
                <span className="font-semibold">Aceptar</span>
                <span className="text-xs opacity-80">Puedo realizar el trabajo</span>
              </Button>

              <Button
                variant={action === 'reject' ? 'default' : 'outline'}
                className={`h-auto py-4 flex-col gap-2 ${action === 'reject' ? 'ring-2 ring-orange-500 bg-orange-500 hover:bg-orange-600' : ''}`}
                onClick={() => setAction('reject')}
              >
                <XCircle className={`h-8 w-8 ${action === 'reject' ? 'text-white' : 'text-orange-500'}`} />
                <span className="font-semibold">Rechazar</span>
                <span className="text-xs opacity-80">No puedo aceptarlo</span>
              </Button>
            </div>

            {/* Reject reason (required) */}
            {action === 'reject' && (
              <div className="space-y-2">
                <Label htmlFor="comments" className="flex items-center gap-1">
                  Motivo del rechazo <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="comments"
                  placeholder="Explica por qué no puedes aceptar este trabajo..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  Si no estás de acuerdo con el importe o no hay un importe previsto, dinos en notas adicionales tus comentarios, tiempo previsto de ejecución o presupuesto adhoc para el mismo.
                </p>
              </div>
            )}

            {/* Optional comments for accept */}
            {action === 'accept' && (
              <div className="space-y-2">
                <Label htmlFor="comments">Comentarios (opcional)</Label>
                <Textarea
                  id="comments"
                  placeholder="Añade cualquier comentario o pregunta..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={2}
                />
                <p className="text-sm text-muted-foreground">
                  Si no estás de acuerdo con el importe o no hay un importe previsto, dinos en notas adicionales tus comentarios, tiempo previsto de ejecución o presupuesto adhoc para el mismo.
                </p>
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
                    Confirmar Rechazo
                  </>
                )}
              </Button>
            )}

            {/* Legal notice */}
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1 mb-1">
                <Shield className="h-3 w-3" />
                <strong>Aviso</strong>
              </p>
              <p>
                Al confirmar, se registrará tu dirección IP y fecha/hora como evidencia digital de tu decisión. 
                También se notificará automáticamente al equipo de gestión.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
