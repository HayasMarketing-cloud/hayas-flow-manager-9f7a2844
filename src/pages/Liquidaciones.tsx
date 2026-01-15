import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, LayoutGrid, Table as TableIcon, X, Download } from 'lucide-react';
import { exportLiquidationsToExcel } from '@/utils/excel/liquidationsExporter';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useLiquidationFilters, PeriodType } from '@/hooks/useLiquidationFilters';
import { LiquidationCard } from '@/components/liquidations/LiquidationCard';
import { LiquidationTableView } from '@/components/liquidations/LiquidationTableView';
import { LiquidationFormModal } from '@/components/liquidations/LiquidationFormModal';
import { EmailPreviewModal } from '@/components/liquidations/EmailPreviewModal';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { generateLiquidationPDFBase64 } from '@/utils/pdf/liquidationPDFGenerator';
import { useAuth } from '@/contexts/AuthContext';

export default function Liquidaciones() {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLiquidation, setSelectedLiquidation] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [liquidationToDelete, setLiquidationToDelete] = useState<any>(null);
  const [sendEmailDialogOpen, setSendEmailDialogOpen] = useState(false);
  const [liquidationToSend, setLiquidationToSend] = useState<any>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [sendingLiquidationId, setSendingLiquidationId] = useState<string | null>(null);
  const { filters, updateFilter, resetFilters } = useLiquidationFilters();
  const { canAccessFinance, loading: rolesLoading } = useUserRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: liquidations, isLoading } = useQuery({
    queryKey: ['liquidations', filters],
    queryFn: async () => {
      let query = supabase
        .from('liquidations')
        .select(`
          *,
          specialist:specialists(id, name, email),
          liquidation_items(
            id,
            total
          ),
          liquidation_signatures(
            id,
            token,
            status,
            signed_at,
            ip_address,
            dispute_reason,
            expires_at
          )
        `)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.specialistId) {
        query = query.eq('specialist_id', filters.specialistId);
      }
      if (filters.searchTerm) {
        query = query.or(`code.ilike.%${filters.searchTerm}%`);
      }

      // Filtro de período
      if (filters.month && filters.year) {
        query = query.eq('period_year', filters.year).eq('period_month', filters.month);
      } else if (filters.year) {
        query = query.eq('period_year', filters.year);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Calcular el total correcto usando el campo total de liquidation_items
      return data?.map(liquidation => {
        const calculatedTotal = liquidation.liquidation_items?.reduce((sum: number, item: any) => {
          return sum + (Number(item.total) || 0);
        }, 0) || 0;
        
        return {
          ...liquidation,
          calculated_total: calculatedTotal
        };
      });
    },
  });

  const { data: specialists } = useQuery({
    queryKey: ['specialists-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  if (!rolesLoading && !canAccessFinance()) {
    return (
      <AppLayout title="Liquidaciones">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-destructive">No tienes permisos para acceder a esta sección</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const handleCreate = () => {
    setSelectedLiquidation(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEdit = (liquidation: any) => {
    setSelectedLiquidation(liquidation);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleView = (liquidation: any) => {
    setSelectedLiquidation(liquidation);
    setModalMode('view');
    setModalOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (liquidationId: string) => {
      // First, update all related financial_requests to remove liquidation_id and reset status
      const { error: requestsError } = await supabase
        .from('financial_requests')
        .update({ liquidation_id: null })
        .eq('liquidation_id', liquidationId);
      
      if (requestsError) throw requestsError;

      // Delete liquidation_items
      const { error: itemsError } = await supabase
        .from('liquidation_items')
        .delete()
        .eq('liquidation_id', liquidationId);
      
      if (itemsError) throw itemsError;

      // Delete the liquidation
      const { error } = await supabase
        .from('liquidations')
        .delete()
        .eq('id', liquidationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      queryClient.invalidateQueries({ queryKey: ['unliquidated-requests'] });
      toast.success('Liquidación eliminada correctamente');
      setDeleteDialogOpen(false);
      setLiquidationToDelete(null);
    },
    onError: (error) => {
      toast.error('Error al eliminar: ' + error.message);
    },
  });

  const handleDelete = (liquidation: any) => {
    setLiquidationToDelete(liquidation);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (liquidationToDelete) {
      deleteMutation.mutate(liquidationToDelete.id);
    }
  };

  const handleSendEmailClick = (liquidation: any) => {
    if (!liquidation.specialist?.email) {
      toast.error('El especialista no tiene email configurado');
      return;
    }
    if (!user?.email?.endsWith('@hayas.es')) {
      toast.error('Solo usuarios con email @hayas.es pueden enviar liquidaciones');
      return;
    }
    setLiquidationToSend(liquidation);
    setSendEmailDialogOpen(true);
  };

  const confirmSendEmail = async () => {
    if (!liquidationToSend) return;

    const liquidation = liquidationToSend;
    setIsSendingEmail(true);
    setSendingLiquidationId(liquidation.id);

    try {
      // Fetch liquidation items with financial_request details
      const { data: items, error: itemsError } = await supabase
        .from('liquidation_items')
        .select(`
          *,
          financial_request:financial_requests(
            id,
            title,
            cost_to_agency,
            client:clients(name)
          )
        `)
        .eq('liquidation_id', liquidation.id);

      if (itemsError) throw itemsError;

      // Generate PDF as base64
      const pdfBase64 = await generateLiquidationPDFBase64({
        liquidation,
        items: items || [],
        specialist: liquidation.specialist,
      });

      // Call edge function to send email with signature token
      const { data, error } = await supabase.functions.invoke('send-liquidation-email', {
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
          senderEmail: user?.email, // Email del usuario que envía
        },
      });

      if (error) throw error;

      // Update liquidation status to 'sent'
      const { error: updateError } = await supabase
        .from('liquidations')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', liquidation.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      setSendEmailDialogOpen(false);
      toast.success(`Email enviado correctamente a ${liquidation.specialist.email}`);
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error('Error al enviar email: ' + (error.message || 'Error desconocido'));
    } finally {
      setIsSendingEmail(false);
      setSendingLiquidationId(null);
      setLiquidationToSend(null);
    }
  };

  const hasActiveFilters = filters.searchTerm || filters.status || filters.specialistId || filters.periodType !== 'current_month';

  return (
    <AppLayout title="Gestión de Liquidaciones">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Liquidaciones</h2>
          {canAccessFinance() && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Liquidación
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Input
                    placeholder="Buscar por código..."
                    value={filters.searchTerm}
                    onChange={(e) => updateFilter('searchTerm', e.target.value)}
                    className="pr-8"
                  />
                  {filters.searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => updateFilter('searchTerm', '')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <Select
                  value={filters.status || 'all'}
                  onValueChange={(value) => updateFilter('status', value === 'all' ? null : value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="validated">Validada</SelectItem>
                    <SelectItem value="sent">Enviada</SelectItem>
                    <SelectItem value="accepted">Aceptada</SelectItem>
                    <SelectItem value="pending_payment">Pendiente de pago</SelectItem>
                    <SelectItem value="paid">Pagada</SelectItem>
                  </SelectContent>
                </Select>

                {specialists && specialists.length > 0 && (
                  <Select
                    value={filters.specialistId || 'all'}
                    onValueChange={(value) => updateFilter('specialistId', value === 'all' ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los especialistas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los especialistas</SelectItem>
                      {specialists.map((specialist) => (
                        <SelectItem key={specialist.id} value={specialist.id}>
                          {specialist.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select
                  value={filters.periodType}
                  onValueChange={(value) => updateFilter('periodType', value as PeriodType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current_month">Mes actual</SelectItem>
                    <SelectItem value="last_month">Mes pasado</SelectItem>
                    <SelectItem value="current_year">Año actual</SelectItem>
                    <SelectItem value="last_year">Año pasado</SelectItem>
                    <SelectItem value="all">Todos los períodos</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filters.periodType === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    value={filters.year?.toString() || ''}
                    onValueChange={(value) => updateFilter('year', value ? parseInt(value) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Año" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.month?.toString() || ''}
                    onValueChange={(value) => updateFilter('month', value ? parseInt(value) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Mes (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Todos los meses</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <SelectItem key={month} value={month.toString()}>
                          {new Date(2024, month - 1).toLocaleDateString('es-ES', { month: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      <X className="h-4 w-4 mr-2" />
                      Limpiar filtros
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!liquidations || liquidations.length === 0) {
                        toast.error('No hay datos para exportar');
                        return;
                      }
                      exportLiquidationsToExcel(liquidations, filters);
                      toast.success('Exportando a Excel...');
                    }}
                    disabled={!liquidations || liquidations.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                  <Button
                    variant={viewMode === 'cards' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('cards')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                  >
                    <TableIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : liquidations && liquidations.length > 0 ? (
          viewMode === 'cards' ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {liquidations.map((liquidation) => (
                <LiquidationCard
                  key={liquidation.id}
                  liquidation={liquidation}
                  onView={handleView}
                  onEdit={handleEdit}
                  onSendEmail={handleSendEmailClick}
                  canManage={canAccessFinance()}
                  isSending={isSendingEmail && sendingLiquidationId === liquidation.id}
                />
              ))}
            </div>
          ) : (
            <LiquidationTableView
              liquidations={liquidations}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSendEmail={handleSendEmailClick}
              canManage={canAccessFinance()}
              isSending={isSendingEmail}
              sendingLiquidationId={sendingLiquidationId || undefined}
            />
          )
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">No se encontraron liquidaciones</p>
            </CardContent>
          </Card>
        )}
      </div>

      <LiquidationFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        liquidation={selectedLiquidation}
        mode={modalMode}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar Liquidación"
        description={`¿Estás seguro de que deseas eliminar la liquidación ${liquidationToDelete?.code}? Las solicitudes asociadas volverán a estar disponibles para liquidación.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      <EmailPreviewModal
        open={sendEmailDialogOpen}
        onOpenChange={setSendEmailDialogOpen}
        liquidation={liquidationToSend}
        onConfirm={confirmSendEmail}
        isSending={isSendingEmail}
        senderEmail={user?.email || undefined}
      />
    </AppLayout>
  );
}
