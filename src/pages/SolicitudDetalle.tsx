import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RequestStatusBadge } from '@/components/requests/RequestStatusBadge';
import { RequestFlowIndicator } from '@/components/requests/RequestFlowIndicator';
import { RequestFlowActions } from '@/components/requests/RequestFlowActions';
import { FlowStatusCell } from '@/components/requests/FlowStatusCell';
import { RequestActivityTimeline } from '@/components/requests/RequestActivityTimeline';
import { RequestProcessTimeline } from '@/components/requests/RequestProcessTimeline';
import { RequestFormModal } from '@/components/modals/RequestFormModal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/request-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { notificationFeedback } from '@/lib/notification-feedback';
import { useState } from 'react';
import {
  ArrowLeft,
  Edit,
  Copy,
  Trash2,
  Building2,
  User,
  Calendar,
  Euro,
  FileText,
  Briefcase,
  Clock,
  ExternalLink
} from 'lucide-react';

const SolicitudDetalle = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessFinance, canAccessOperations } = useUserRole();
  const { user } = useAuth();
  const canManage = canAccessFinance() || canAccessOperations();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const { data: request, isLoading, error } = useQuery({
    queryKey: ['financial_request', id],
    queryFn: async () => {
      if (!id) throw new Error('ID no proporcionado');

      const { data, error } = await supabase
        .from('financial_requests')
        .select(`
          *,
          client:clients(id, name, code),
          service:services(id, name),
          specialist:specialists(id, name, email, user_id),
          contract:contracts(id, title, code),
          budget:budgets(id, title, code),
          invoice:invoices(id, code, status),
          liquidation:liquidations(id, code, status),
          client_contact:client_contacts(id, name, email, role),
          request_action_tokens(id, token, status, acted_at, ip_address, user_agent, comments, expires_at, created_at)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleDelete = async () => {
    if (!id) return;

    // First unlink operational requests
    await supabase
      .from('operational_requests')
      .update({ financial_request_id: null })
      .eq('financial_request_id', id);

    const { error } = await supabase
      .from('financial_requests')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Error al eliminar la solicitud');
    } else {
      toast.success('Solicitud eliminada correctamente');
      navigate('/solicitudes');
    }
    setDeleteConfirmOpen(false);
  };

  const handleClone = async () => {
    if (!request) return;

    const {
      id: _id,
      code: _code,
      created_at: _created_at,
      updated_at: _updated_at,
      client,
      service,
      specialist,
      budget,
      invoice,
      contract,
      liquidation,
      client_contact,
      billed_invoice_id,
      liquidation_id,
      completed_at,
      ...cloneData
    } = request;

    const { data: newCode, error: codeError } = await supabase.rpc('generate_code', { sequence_name: 'requests' });

    if (codeError) {
      toast.error('Error al generar código para la solicitud');
      return;
    }

    const { data: newRequest, error } = await supabase
      .from('financial_requests')
      .insert({
        ...cloneData,
        status: 'draft',
        code: newCode,
        billed_invoice_id: null,
        liquidation_id: null,
        completed_at: null
      })
      .select('id')
      .single();

    if (error) {
      toast.error('Error al clonar la solicitud');
    } else {
      toast.success('Solicitud clonada correctamente');
      navigate(`/solicitudes/${newRequest.id}`);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['financial_request', id] });
    queryClient.invalidateQueries({ queryKey: ['request-activity', id] });
  };

  // Resend email to specialist
  const handleResendEmail = async () => {
    if (!request?.specialist?.email || !user?.email?.endsWith('@hayas.es')) {
      toast.error('No se puede reenviar el email');
      return;
    }

    setIsSendingEmail(true);
    try {
      const appUrl = window.location.origin;
      const { error } = await supabase.functions.invoke('send-request-notification', {
        body: {
          requestId: request.id,
          notificationType: 'specialist_assigned',
          recipientEmail: request.specialist.email,
          recipientName: request.specialist.name || 'Especialista',
          senderEmail: user.email,
          appUrl,
        },
      });

      if (error) throw error;
      toast.success('Email reenviado al especialista');
      notificationFeedback.emailToSpecialist(request.specialist.name || 'Especialista');
      handleRefresh();
    } catch (error) {
      console.error('Error resending email:', error);
      toast.error('Error al reenviar el email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Cargando..." description="">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  if (error || !request) {
    return (
      <AppLayout title="Error" description="">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-destructive mb-4">
              {error ? 'Error al cargar la solicitud' : 'Solicitud no encontrada'}
            </p>
            <Button variant="outline" onClick={() => navigate('/solicitudes')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Solicitudes
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  // Calculate totals
  const saleAmount = request.sale_amount ||
    (request.sale_type === 'hourly'
      ? (request.sale_hours || 0) * (request.sale_rate || 0)
      : (request.unit_price || 0) * (request.quantity || 1));

  const costAmount = request.cost_to_agency ||
    (request.cost_type === 'hourly'
      ? (request.hours || 0) * (request.cost_rate || 0)
      : (request.fixed_cost || 0));

  const margin = saleAmount - costAmount;
  const marginPercent = saleAmount > 0 ? (margin / saleAmount) * 100 : 0;

  return (
    <AppLayout
      title={request.title}
      description={`${request.code} - Detalles de la solicitud`}
    >
      <div className="space-y-6">
        {/* Back button and header */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/solicitudes')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <span className="font-mono text-sm text-muted-foreground">{request.code}</span>
            <h1 className="text-2xl font-bold">{request.title}</h1>
          </div>
        </div>

        {/* Header with status and actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <RequestStatusBadge status={request.status} />
                <RequestFlowIndicator status={request.status} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <RequestFlowActions request={request} onSuccess={handleRefresh} compact />
                
                {canManage && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleClone}>
                      <Copy className="h-4 w-4 mr-2" />
                      Clonar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
                      <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                      Eliminar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Resumen</TabsTrigger>
            <TabsTrigger value="financial">Económico</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left column - Details */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold">{request.client?.name}</p>
                  {request.client?.code && (
                    <Badge variant="outline" className="mt-1">{request.client.code}</Badge>
                  )}
                </CardContent>
              </Card>

              {/* Specialist Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Especialista
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {request.specialist ? (
                    <>
                      <p className="font-semibold">{request.specialist.name}</p>
                      {request.specialist.email && (
                        <p className="text-sm text-muted-foreground">{request.specialist.email}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">Sin asignar</p>
                  )}
                </CardContent>
              </Card>

              {/* Service */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Servicio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold">{request.service?.name || 'Sin especificar'}</p>
                </CardContent>
              </Card>

              {/* Dates */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Fechas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Creada:</span>{' '}
                    {format(new Date(request.created_at), "dd MMM yyyy", { locale: es })}
                  </p>
                  {request.deadline && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Fecha límite:</span>{' '}
                      {format(new Date(request.deadline), "dd MMM yyyy", { locale: es })}
                    </p>
                  )}
                  {request.completed_at && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Completada:</span>{' '}
                      {format(new Date(request.completed_at), "dd MMM yyyy", { locale: es })}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Contract */}
              {request.contract && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Contrato
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{request.contract.code}</Badge>
                      <span>{request.contract.title}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Budget */}
              {request.budget && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Presupuesto
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{request.budget.code}</Badge>
                      <span>{request.budget.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => navigate(`/presupuestos/${request.budget.id}`)}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contact */}
              {request.client_contact && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Contacto Solicitante
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-semibold">{request.client_contact.name}</p>
                    {request.client_contact.role && (
                      <p className="text-sm text-muted-foreground">{request.client_contact.role}</p>
                    )}
                    {request.client_contact.email && (
                      <p className="text-sm text-muted-foreground">{request.client_contact.email}</p>
                    )}
                  </CardContent>
                </Card>
              )}
                </div>

                {/* Description */}
                {request.description && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Descripción</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap">{request.description}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Invoice & Liquidation Status */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Estado de Facturación</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Factura</p>
                        <FlowStatusCell
                          type="invoice"
                          linkedId={request.billed_invoice_id}
                          linkedCode={request.invoice?.code}
                          linkedStatus={request.invoice?.status}
                        />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Liquidación</p>
                        <FlowStatusCell
                          type="liquidation"
                          linkedId={request.liquidation_id}
                          linkedCode={request.liquidation?.code}
                          linkedStatus={request.liquidation?.status}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right column - Process Timeline */}
              <div className="lg:col-span-1">
                <RequestProcessTimeline 
                  request={{
                    id: request.id,
                    status: request.status as any,
                    created_at: request.created_at,
                    updated_at: request.updated_at,
                    specialist: request.specialist,
                  }}
                  actionToken={request.request_action_tokens?.[0] ? {
                    ...request.request_action_tokens[0],
                    status: request.request_action_tokens[0].status as 'pending' | 'accepted' | 'rejected' | 'expired'
                  } : null}
                  onResendEmail={canManage ? handleResendEmail : undefined}
                  isSending={isSendingEmail}
                />
              </div>
            </div>
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sale */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-600">Precio de Venta</CardTitle>
                  <CardDescription>
                    {request.sale_type === 'hourly' ? 'Por horas' : 'Precio fijo'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(saleAmount)}</p>
                  {request.sale_type === 'hourly' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {request.sale_hours || 0} h × {formatCurrency(request.sale_rate || 0)}/h
                    </p>
                  )}
                  {request.sale_type === 'fixed' && request.quantity > 1 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {request.quantity} × {formatCurrency(request.unit_price || 0)}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Cost */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-red-600">Coste para Agencia</CardTitle>
                  <CardDescription>
                    {request.cost_type === 'hourly' ? 'Por horas' : 'Coste fijo'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(costAmount)}</p>
                  {request.cost_type === 'hourly' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {request.hours || 0} h × {formatCurrency(request.cost_rate || 0)}/h
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Margin */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Margen</CardTitle>
                  <CardDescription>
                    {marginPercent.toFixed(1)}% del precio de venta
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${margin >= 0 ? 'text-blue-600' : 'text-destructive'}`}>
                    {formatCurrency(margin)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Historial de Actividad
                </CardTitle>
                <CardDescription>
                  Registro cronológico de todos los eventos de esta solicitud
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RequestActivityTimeline requestId={request.id} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Modal */}
      <RequestFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        initialData={request}
        onSuccess={handleRefresh}
        mode="edit"
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Eliminar Solicitud"
        description={`¿Estás seguro de que deseas eliminar la solicitud "${request.code}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </AppLayout>
  );
};

export default SolicitudDetalle;
