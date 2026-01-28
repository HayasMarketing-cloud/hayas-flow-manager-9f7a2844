import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, User, Calendar, FileText, Mail, Download, Trash2, Plus, Sparkles } from 'lucide-react';
import { AddRequestsToLiquidationModal } from '@/components/liquidations/AddRequestsToLiquidationModal';
import { SpecialistInvoiceUpload } from '@/components/liquidations/SpecialistInvoiceUpload';
import { SpecialistInvoiceImportModal } from '@/components/liquidations/SpecialistInvoiceImportModal';
import { LiquidationStatusBadge } from '@/components/liquidations/LiquidationStatusBadge';
import { SignatureStatusBadge } from '@/components/liquidations/SignatureStatusBadge';
import { LiquidationProcessTimeline } from '@/components/liquidations/LiquidationProcessTimeline';
import { formatPeriod, formatCurrency } from '@/lib/liquidation-utils';
import { useUserRole } from '@/hooks/useUserRole';
import { useUnliquidatedRequests } from '@/hooks/useUnliquidatedRequests';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { notificationFeedback } from '@/lib/notification-feedback';
import { generateLiquidationPDF, generateLiquidationPDFBase64 } from '@/utils/pdf/liquidationPDFGenerator';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useState } from 'react';
import { notifyLiquidationSent } from '@/lib/notification-utils';

// Component for pending requests section
function PendingRequestsSection({ 
  specialistId,
  liquidationId,
  periodYear,
  periodMonth,
  onAddRequest,
  onRequestAdded,
}: { 
  specialistId: string;
  liquidationId: string;
  periodYear: number;
  periodMonth: number;
  onAddRequest: () => void;
  onRequestAdded: () => void;
}) {
  const { data: unliquidatedRequests, isLoading } = useUnliquidatedRequests(specialistId, periodYear, periodMonth);
  const [addingRequestId, setAddingRequestId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const addSingleRequest = async (request: any) => {
    if (addingRequestId) return;
    
    setAddingRequestId(request.id);
    try {
      const cost = Number(request.cost_to_agency) || 0;

      // Create liquidation item
      const { error: itemError } = await supabase
        .from('liquidation_items')
        .insert({
          liquidation_id: liquidationId,
          financial_request_id: request.id,
          description: `${request.code} - ${request.title}`,
          quantity: 1,
          unit_price: cost,
          total: cost,
        });

      if (itemError) throw itemError;

      // Update financial request
      const { error: requestError } = await supabase
        .from('financial_requests')
        .update({ liquidation_id: liquidationId })
        .eq('id', request.id);

      if (requestError) throw requestError;

      // Get current liquidation total and update
      const { data: liquidation, error: fetchError } = await supabase
        .from('liquidations')
        .select('total_amount')
        .eq('id', liquidationId)
        .single();

      if (fetchError) throw fetchError;

      const newTotal = (Number(liquidation.total_amount) || 0) + cost;
      const { error: updateError } = await supabase
        .from('liquidations')
        .update({ total_amount: newTotal })
        .eq('id', liquidationId);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['liquidation-detail'] });
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      queryClient.invalidateQueries({ queryKey: ['unliquidated-requests'] });
      
      toast.success(`Solicitud ${request.code} añadida a la liquidación`);
      onRequestAdded();
    } catch (error: any) {
      toast.error('Error al añadir solicitud: ' + error.message);
    } finally {
      setAddingRequestId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trabajos pendientes para próxima liquidación</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!unliquidatedRequests || unliquidatedRequests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trabajos pendientes para próxima liquidación</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            No hay trabajos pendientes para próxima liquidación
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPending = unliquidatedRequests.reduce((sum, req) => sum + (Number(req.cost_to_agency) || 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Trabajos pendientes para próxima liquidación</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {unliquidatedRequests.length} trabajo(s) disponible(s) • Total: {formatCurrency(totalPending)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAddRequest}>
          <Plus className="h-4 w-4 mr-2" />
          Añadir varias
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Haz clic en una fila para añadirla directamente a la liquidación
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Coste</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unliquidatedRequests.slice(0, 5).map((request) => (
              <TableRow 
                key={request.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => addSingleRequest(request)}
              >
                <TableCell className="font-mono text-sm">{request.code}</TableCell>
                <TableCell className="max-w-[200px] truncate">{request.title}</TableCell>
                <TableCell>{request.client?.name || '-'}</TableCell>
                <TableCell>{request.service?.name || '-'}</TableCell>
                <TableCell>
                  <Badge variant={request.status === 'completed' ? 'default' : 'secondary'}>
                    {request.status === 'completed' ? 'Completado' : 'En progreso'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(Number(request.cost_to_agency) || 0)}
                </TableCell>
                <TableCell>
                  {addingRequestId === request.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {unliquidatedRequests.length > 5 && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Y {unliquidatedRequests.length - 5} trabajo(s) más...{' '}
            <button 
              onClick={onAddRequest}
              className="text-primary hover:underline"
            >
              Ver todas
            </button>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function LiquidacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessFinance } = useUserRole();
  const { user } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [addRequestsModalOpen, setAddRequestsModalOpen] = useState(false);
  const [importInvoiceModalOpen, setImportInvoiceModalOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{ id: string; requestId: string | null; description: string } | null>(null);

  const { data: liquidation, isLoading, error } = useQuery({
    queryKey: ['liquidation-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liquidations')
        .select(`
          *,
          specialist:specialists(id, name, email, hourly_rate, type, user_id),
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
              hours,
              quantity,
              cost_type,
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
            expires_at,
            created_at
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Calcular el total correcto
      const calculatedTotal = data.liquidation_items?.reduce((sum: number, item: any) => {
        return sum + (Number(item.total) || 0);
      }, 0) || 0;

      // Ordenar firmas por fecha descendente para obtener siempre la más reciente primero
      const sortedSignatures = data.liquidation_signatures
        ?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return { ...data, liquidation_signatures: sortedSignatures, calculated_total: calculatedTotal };
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

  const removeItemMutation = useMutation({
    mutationFn: async ({ itemId, requestId }: { itemId: string; requestId: string | null }) => {
      // Get the item to know the total to subtract
      const { data: item, error: fetchError } = await supabase
        .from('liquidation_items')
        .select('total')
        .eq('id', itemId)
        .single();

      if (fetchError) throw fetchError;

      // Delete the liquidation item
      const { error: deleteError } = await supabase
        .from('liquidation_items')
        .delete()
        .eq('id', itemId);

      if (deleteError) throw deleteError;

      // Update the financial_request to remove liquidation_id
      if (requestId) {
        const { error: updateError } = await supabase
          .from('financial_requests')
          .update({ liquidation_id: null })
          .eq('id', requestId);

        if (updateError) throw updateError;
      }

      // Recalculate and update liquidation total
      const newTotal = (liquidation?.calculated_total || 0) - (Number(item.total) || 0);
      const { error: liquidationError } = await supabase
        .from('liquidations')
        .update({ total_amount: Math.max(0, newTotal) })
        .eq('id', id);

      if (liquidationError) throw liquidationError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      queryClient.invalidateQueries({ queryKey: ['unliquidated-requests'] });
      toast.success('Solicitud eliminada de la liquidación');
      setItemToRemove(null);
    },
    onError: (error: any) => {
      toast.error('Error al eliminar: ' + error.message);
    },
  });

  const handleDownloadPDF = async () => {
    if (!liquidation) return;

    try {
      // Fetch pending requests for this specialist
      const { data: pendingRequests } = await supabase
        .from('financial_requests')
        .select(`id, code, title, status, cost_to_agency, client:clients(id, name)`)
        .eq('specialist_id', liquidation.specialist?.id)
        .is('liquidation_id', null)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      await generateLiquidationPDF({
        liquidation,
        items: liquidation.liquidation_items || [],
        specialist: liquidation.specialist,
        pendingRequests: pendingRequests || [],
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
      // Fetch pending requests for this specialist
      const { data: pendingRequests } = await supabase
        .from('financial_requests')
        .select(`id, code, title, status, cost_to_agency, client:clients(id, name)`)
        .eq('specialist_id', liquidation.specialist?.id)
        .is('liquidation_id', null)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      const pdfBase64 = await generateLiquidationPDFBase64({
        liquidation,
        items: liquidation.liquidation_items || [],
        specialist: liquidation.specialist,
        pendingRequests: pendingRequests || [],
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

      // Send in-app notification to specialist if they have user_id
      const hasInAppNotification = !!liquidation.specialist?.user_id;
      await notifyLiquidationSent(
        liquidation.specialist?.user_id || null,
        liquidation.code,
        liquidation.id,
        liquidation.period_month,
        liquidation.period_year
      );

      queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      toast.success(`Email enviado correctamente a ${liquidation.specialist.email}`);
      
      // Show notification feedback
      notificationFeedback.liquidationSent(liquidation.specialist.name, hasInAppNotification);
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
    <AppLayout title={`Liquidación ${formatPeriod(liquidation.period_year, liquidation.period_month)}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/liquidaciones')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Liquidación {formatPeriod(liquidation.period_year, liquidation.period_month)}</h1>
              <p className="text-muted-foreground">{liquidation.code}</p>
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

        {/* Process Timeline */}
        <LiquidationProcessTimeline 
          liquidation={liquidation}
          signature={latestSignature}
          onResendEmail={hasSpecialistEmail && canAccessFinance() ? handleSendEmail : undefined}
          isSending={isSending}
        />

        {/* Items Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Trabajos incluidos</CardTitle>
            {isEditable && canAccessFinance() && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setAddRequestsModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Añadir Solicitudes
              </Button>
            )}
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
                    {isEditable && canAccessFinance() && <TableHead className="w-10"></TableHead>}
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
                      <TableCell className="text-right">
                        {item.financial_request?.cost_type === 'hourly'
                          ? (item.financial_request?.hours ?? item.quantity)
                          : (item.financial_request?.quantity ?? item.quantity)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                      {isEditable && canAccessFinance() && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemToRemove({
                                id: item.id,
                                requestId: item.financial_request?.id || null,
                                description: item.description,
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">No hay items en esta liquidación</p>
            )}
          </CardContent>
        </Card>

        {/* Pending Requests Section */}
        {isEditable && canAccessFinance() && (
          <PendingRequestsSection 
            specialistId={liquidation.specialist_id}
            liquidationId={liquidation.id}
            periodYear={liquidation.period_year}
            periodMonth={liquidation.period_month}
            onAddRequest={() => setAddRequestsModalOpen(true)}
            onRequestAdded={() => {
              queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
            }}
          />
        )}

        {/* Specialist Invoice Upload - Para todos los estados excepto pagado */}
        {canAccessFinance() && ['draft', 'validated', 'sent', 'accepted', 'invoice_received', 'pending_payment'].includes(liquidation.status) && (
          <SpecialistInvoiceUpload
            liquidationId={liquidation.id}
            liquidationCode={liquidation.code}
            currentInvoiceUrl={liquidation.specialist_invoice_url}
            currentStatus={liquidation.status}
            liquidationSubtotal={liquidation.subtotal}
            onUploadSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
              queryClient.invalidateQueries({ queryKey: ['liquidations'] });
            }}
          />
        )}

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

      <ConfirmDialog
        open={!!itemToRemove}
        onOpenChange={(open) => !open && setItemToRemove(null)}
        title="Eliminar solicitud de la liquidación"
        description={`¿Estás seguro de que deseas eliminar "${itemToRemove?.description}" de esta liquidación? La solicitud quedará disponible para incluir en otras liquidaciones.`}
        onConfirm={() => itemToRemove && removeItemMutation.mutate({ itemId: itemToRemove.id, requestId: itemToRemove.requestId })}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
      />

      <AddRequestsToLiquidationModal
        open={addRequestsModalOpen}
        onOpenChange={setAddRequestsModalOpen}
        liquidationId={liquidation.id}
        specialistId={liquidation.specialist_id}
        periodYear={liquidation.period_year}
        periodMonth={liquidation.period_month}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
        }}
      />

      <SpecialistInvoiceImportModal
        open={importInvoiceModalOpen}
        onOpenChange={setImportInvoiceModalOpen}
        preselectedLiquidationId={liquidation.id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['liquidation-detail', id] });
          queryClient.invalidateQueries({ queryKey: ['liquidations'] });
        }}
      />
    </AppLayout>
  );
}
