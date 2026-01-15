import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, User, Calendar, FileText, Mail, Download, Trash2 } from 'lucide-react';
import { LiquidationStatusBadge } from '@/components/liquidations/LiquidationStatusBadge';
import { SignatureStatusBadge } from '@/components/liquidations/SignatureStatusBadge';
import { formatPeriod, formatCurrency } from '@/lib/liquidation-utils';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { generateLiquidationPDF, generateLiquidationPDFBase64 } from '@/utils/pdf/liquidationPDFGenerator';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useState } from 'react';

export default function LiquidacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessFinance } = useUserRole();
  const { user } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { data: liquidation, isLoading, error } = useQuery({
    queryKey: ['liquidation-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liquidations')
        .select(`
          *,
          specialist:specialists(id, name, email, hourly_rate, type),
          liquidation_items(
            id,
            description,
            quantity,
            unit_price,
            total,
            financial_request:financial_requests(
              id,
              code,
              title,
              client:clients(id, name)
            )
          ),
          liquidation_signatures(
            id,
            token,
            status,
            signed_at,
            ip_address,
            dispute_reason,
            specialist_comments,
            expires_at
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Calcular el total correcto
      const calculatedTotal = data.liquidation_items?.reduce((sum: number, item: any) => {
        return sum + (Number(item.total) || 0);
      }, 0) || 0;

      return { ...data, calculated_total: calculatedTotal };
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;

      // Update related financial_requests
      const { error: requestsError } = await supabase
        .from('financial_requests')
        .update({ liquidation_id: null })
        .eq('liquidation_id', id);

      if (requestsError) throw requestsError;

      // Delete liquidation_items
      const { error: itemsError } = await supabase
        .from('liquidation_items')
        .delete()
        .eq('liquidation_id', id);

      if (itemsError) throw itemsError;

      // Delete liquidation_signatures
      const { error: signaturesError } = await supabase
        .from('liquidation_signatures')
        .delete()
        .eq('liquidation_id', id);

      if (signaturesError) throw signaturesError;

      // Delete the liquidation
      const { error } = await supabase
        .from('liquidations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      toast.success('Liquidación eliminada correctamente');
      navigate('/liquidaciones');
    },
    onError: (error: any) => {
      toast.error('Error al eliminar: ' + error.message);
    },
  });

  const handleDownloadPDF = async () => {
    if (!liquidation) return;

    try {
      await generateLiquidationPDF({
        liquidation,
        items: liquidation.liquidation_items || [],
        specialist: liquidation.specialist,
      });
      toast.success('PDF descargado');
    } catch (error: any) {
      toast.error('Error al generar PDF: ' + error.message);
    }
  };

  const handleSendEmail = async () => {
    if (!liquidation || !liquidation.specialist?.email) {
      toast.error('El especialista no tiene email configurado');
      return;
    }

    if (!user?.email?.endsWith('@hayas.es')) {
      toast.error('Solo usuarios con email @hayas.es pueden enviar liquidaciones');
      return;
    }

    setIsSending(true);

    try {
      const pdfBase64 = await generateLiquidationPDFBase64({
        liquidation,
        items: liquidation.liquidation_items || [],
        specialist: liquidation.specialist,
      });

      const { error } = await supabase.functions.invoke('send-liquidation-email', {
        body: {
          specialistName: liquidation.specialist.name,
          specialistEmail: liquidation.specialist.email,
          liquidationCode: liquidation.code,
          liquidationId: liquidation.id,
          periodMonth: liquidation.period_month,
          periodYear: liquidation.period_year,
          totalAmount: liquidation.calculated_total ?? liquidation.total_amount,
          pdfBase64,
          appUrl: window.location.origin,
          senderEmail: user?.email,
        },
      });

      if (error) throw error;

      // Update liquidation status
      await supabase
        .from('liquidations')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', id);

      queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      toast.success(`Email enviado correctamente a ${liquidation.specialist.email}`);
    } catch (error: any) {
      toast.error('Error al enviar email: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Detalle de Liquidación">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  if (error || !liquidation) {
    return (
      <AppLayout title="Detalle de Liquidación">
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 gap-4">
            <p className="text-destructive">Liquidación no encontrada</p>
            <Button variant="outline" onClick={() => navigate('/liquidaciones')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Liquidaciones
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const latestSignature = liquidation.liquidation_signatures?.[0] || null;
  const isEditable = liquidation.status === 'draft' || liquidation.status === 'validated';
  const hasSpecialistEmail = !!liquidation.specialist?.email;

  return (
    <AppLayout title={`Liquidación ${liquidation.code}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/liquidaciones')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{liquidation.code}</h1>
              <p className="text-muted-foreground">{formatPeriod(liquidation.period_year, liquidation.period_month)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LiquidationStatusBadge status={liquidation.status} />
            {liquidation.status !== 'draft' && latestSignature && (
              <SignatureStatusBadge signature={latestSignature} />
            )}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Specialist Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Especialista
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{liquidation.specialist?.name || 'Sin asignar'}</p>
              {liquidation.specialist?.email && (
                <p className="text-sm text-muted-foreground">{liquidation.specialist.email}</p>
              )}
              {liquidation.specialist?.type && (
                <Badge variant="outline" className="mt-2">
                  {liquidation.specialist.type}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Period Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Creada</p>
                <p className="font-medium">{new Date(liquidation.created_at).toLocaleDateString('es-ES')}</p>
              </div>
              {liquidation.sent_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Enviada</p>
                  <p className="font-medium">{new Date(liquidation.sent_at).toLocaleDateString('es-ES')}</p>
                </div>
              )}
              {liquidation.paid_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Pagada</p>
                  <p className="font-medium">{new Date(liquidation.paid_at).toLocaleDateString('es-ES')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Total */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Resumen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items:</span>
                  <span className="font-medium">{liquidation.liquidation_items?.length || 0}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span className="text-primary">{formatCurrency(liquidation.calculated_total ?? liquidation.total_amount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Signature Info */}
        {latestSignature && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Estado de Firma</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <SignatureStatusBadge signature={latestSignature} />
                {latestSignature.signed_at && (
                  <span className="text-sm text-muted-foreground">
                    Firmada el {new Date(latestSignature.signed_at).toLocaleString('es-ES')}
                  </span>
                )}
                {latestSignature.dispute_reason && (
                  <div className="flex-1">
                    <p className="text-sm text-destructive font-medium">Motivo de disputa:</p>
                    <p className="text-sm">{latestSignature.dispute_reason}</p>
                  </div>
                )}
                {latestSignature.specialist_comments && (
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground font-medium">Comentarios:</p>
                    <p className="text-sm">{latestSignature.specialist_comments}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items Table */}
        <Card>
          <CardHeader>
            <CardTitle>Solicitudes incluidas</CardTitle>
          </CardHeader>
          <CardContent>
            {liquidation.liquidation_items && liquidation.liquidation_items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liquidation.liquidation_items.map((item: any) => (
                    <TableRow 
                      key={item.id}
                      className={item.financial_request?.id ? 'cursor-pointer hover:bg-muted/50' : ''}
                      onClick={() => item.financial_request?.id && navigate(`/solicitudes/${item.financial_request.id}`)}
                    >
                      <TableCell className="font-mono text-sm">
                        {item.financial_request?.code || '-'}
                      </TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.financial_request?.client?.name || '-'}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">No hay items en esta liquidación</p>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {liquidation.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{liquidation.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {canAccessFinance() && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
            {isEditable && hasSpecialistEmail && (
              <Button onClick={handleSendEmail} disabled={isSending}>
                <Mail className="h-4 w-4 mr-2" />
                {isSending ? 'Enviando...' : 'Enviar por Email'}
              </Button>
            )}
            {isEditable && (
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar liquidación"
        description={`¿Estás seguro de que deseas eliminar la liquidación ${liquidation.code}? Esta acción no se puede deshacer.`}
        onConfirm={() => deleteMutation.mutate()}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
      />
    </AppLayout>
  );
}
