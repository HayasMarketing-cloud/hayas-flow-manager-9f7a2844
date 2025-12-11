import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, LayoutGrid, Table as TableIcon, Download, Trash2, Receipt } from 'lucide-react';
import { exportRequestsToExcel } from '@/utils/excel/requestsExporter';
import { toast } from 'sonner';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RequestFormModal } from '@/components/modals/RequestFormModal';
import { RequestCard } from '@/components/requests/RequestCard';
import { RequestTableView } from '@/components/requests/RequestTableView';
import { useRequestFilters } from '@/hooks/useRequestFilters';
import { useUserRole } from '@/hooks/useUserRole';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AddToLiquidationModal } from '@/components/liquidations/AddToLiquidationModal';

const Solicitudes = () => {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<any>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [addToLiquidationOpen, setAddToLiquidationOpen] = useState(false);
  const queryClient = useQueryClient();
  const { filters, updateFilter, resetFilters } = useRequestFilters();
  const { canAccessFinance, canAccessOperations, loading: rolesLoading } = useUserRole();
  const canManage = canAccessFinance() || canAccessOperations();

  const { data: requests, isLoading, error } = useQuery({
    queryKey: ['financial_requests', filters],
    queryFn: async () => {
      let query = supabase
        .from('financial_requests')
        .select(
          `
          *,
          client:clients(id, name, code),
          service:services(id, name),
          specialist:specialists(id, name),
          budget:budgets(id, title, code, client_contact_id)
        `
        )
        .order('created_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status as any);
      }
      if (filters.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters.specialistId) {
        query = query.eq('specialist_id', filters.specialistId);
      }
      if (filters.searchTerm) {
        query = query.or(
          `title.ilike.%${filters.searchTerm}%,code.ilike.%${filters.searchTerm}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, code')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: specialists } = useQuery({
    queryKey: ['specialists-filter'],
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

  const handleNewRequest = () => {
    setSelectedRequest(null);
    setModalOpen(true);
  };

  const handleEditRequest = (request: any) => {
    setSelectedRequest(request);
    setModalOpen(true);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
  };

  const handleDeleteRequest = async (requestId: string) => {
    // First, unlink any operational_requests that reference this financial_request
    await supabase
      .from('operational_requests')
      .update({ financial_request_id: null })
      .eq('financial_request_id', requestId);

    const { error } = await supabase
      .from('financial_requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      toast.error('Error al eliminar la solicitud');
    } else {
      toast.success('Solicitud eliminada correctamente');
      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
    }
    setDeleteConfirmOpen(false);
    setRequestToDelete(null);
  };

  const handleCloneRequest = async (request: any) => {
    const { id, code, created_at, updated_at, client, service, specialist, ...cloneData } = request;

    const { error } = await supabase
      .from('financial_requests')
      .insert({ ...cloneData, status: 'draft', code: '' });

    if (error) {
      toast.error('Error al clonar la solicitud');
    } else {
      toast.success('Solicitud clonada correctamente');
      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
    }
  };

  const handleBulkDelete = async () => {
    // First, unlink any operational_requests that reference these financial_requests
    const { error: unlinkError } = await supabase
      .from('operational_requests')
      .update({ financial_request_id: null })
      .in('financial_request_id', selectedIds);

    if (unlinkError) {
      toast.error('Error al desvincular solicitudes operativas');
      setBulkDeleteConfirmOpen(false);
      return;
    }

    // Then delete the financial requests
    const { error } = await supabase
      .from('financial_requests')
      .delete()
      .in('id', selectedIds);

    if (error) {
      toast.error('Error al eliminar las solicitudes');
    } else {
      toast.success(`${selectedIds.length} solicitudes eliminadas`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
    }
    setBulkDeleteConfirmOpen(false);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && requests) {
      setSelectedIds(requests.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    }
  };

  const confirmDelete = (request: any) => {
    setRequestToDelete(request);
    setDeleteConfirmOpen(true);
  };

  if (error) {
    return (
      <AppLayout title="Solicitudes" description="Gestión de solicitudes de servicios">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-destructive">Error al cargar solicitudes: {String(error?.message || 'Error desconocido')}</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Solicitudes" description="Gestión de solicitudes de servicios">
      <div className="space-y-6">
        {/* Barra de filtros */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título o código..."
                value={filters.searchTerm}
                onChange={(e) => updateFilter('searchTerm', e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!requests || requests.length === 0) {
                    toast.error('No hay datos para exportar');
                    return;
                  }
                  exportRequestsToExcel(requests, filters);
                  toast.success('Exportando a Excel...');
                }}
                disabled={!requests || requests.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('table')}
              >
                <TableIcon className="h-4 w-4" />
              </Button>
              {!rolesLoading && canManage && (
                <Button onClick={handleNewRequest}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Solicitud
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) =>
                updateFilter('status', value === 'all' ? null : (value as any))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="invoiced">Facturado</SelectItem>
                <SelectItem value="liquidated">Liquidado</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.clientId || 'all'}
              onValueChange={(value) =>
                updateFilter('clientId', value === 'all' ? null : value)
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.specialistId || 'all'}
              onValueChange={(value) =>
                updateFilter('specialistId', value === 'all' ? null : value)
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos los especialistas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los especialistas</SelectItem>
                {specialists?.map((specialist) => (
                  <SelectItem key={specialist.id} value={specialist.id}>
                    {specialist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filters.status || filters.clientId || filters.specialistId || filters.searchTerm) && (
              <Button variant="outline" onClick={resetFilters}>
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Barra de acciones en grupo */}
        {selectedIds.length > 0 && viewMode === 'table' && (
          <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
            <span className="text-sm font-medium">{selectedIds.length} seleccionados</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddToLiquidationOpen(true)}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Añadir a Liquidación
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar seleccionados
            </Button>
          </div>
        )}

        {/* Contenido principal */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : requests && requests.length > 0 ? (
          viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {requests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onEdit={handleEditRequest}
                  onDelete={confirmDelete}
                  onClone={handleCloneRequest}
                  canManage={canManage}
                />
              ))}
            </div>
          ) : (
            <RequestTableView
              requests={requests}
              onEdit={handleEditRequest}
              onDelete={confirmDelete}
              onClone={handleCloneRequest}
              canManage={canManage}
              selectedIds={selectedIds}
              onSelectAll={handleSelectAll}
              onSelectOne={handleSelectOne}
            />
          )
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-muted-foreground text-lg mb-2">
                {filters.searchTerm || filters.status || filters.clientId || filters.specialistId
                  ? 'No se encontraron solicitudes'
                  : 'No hay solicitudes registradas'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {filters.searchTerm || filters.status || filters.clientId || filters.specialistId
                  ? 'Intenta con otros filtros'
                  : 'Crea tu primera solicitud para comenzar'}
              </p>
              {!rolesLoading &&
                canManage &&
                !filters.searchTerm &&
                !filters.status &&
                !filters.clientId &&
                !filters.specialistId && (
                  <Button onClick={handleNewRequest}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Solicitud
                  </Button>
                )}
            </CardContent>
          </Card>
        )}
      </div>

      <RequestFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialData={selectedRequest}
        onSuccess={handleSuccess}
        mode={selectedRequest ? 'edit' : 'create'}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Eliminar solicitud"
        description={`¿Estás seguro de eliminar la solicitud "${requestToDelete?.title}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        onConfirm={() => requestToDelete && handleDeleteRequest(requestToDelete.id)}
        variant="destructive"
      />

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onOpenChange={setBulkDeleteConfirmOpen}
        title="Eliminar solicitudes"
        description={`¿Estás seguro de eliminar ${selectedIds.length} solicitudes? Esta acción no se puede deshacer.`}
        confirmText="Eliminar todas"
        onConfirm={handleBulkDelete}
        variant="destructive"
      />

      <AddToLiquidationModal
        open={addToLiquidationOpen}
        onOpenChange={setAddToLiquidationOpen}
        requestIds={selectedIds}
        onSuccess={() => {
          setSelectedIds([]);
          queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
        }}
      />
    </AppLayout>
  );
};

export default Solicitudes;
