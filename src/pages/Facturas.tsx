import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, LayoutGrid, Table as TableIcon, X, Download, Upload, CreditCard } from 'lucide-react';
import { exportInvoicesToExcel } from '@/utils/excel/invoicesExporter';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useAssignedClients } from '@/hooks/useAssignedClients';
import { InvoiceCard } from '@/components/invoices/InvoiceCard';
import { InvoiceTableView } from '@/components/invoices/InvoiceTableView';
import { InvoiceFormModal } from '@/components/modals/InvoiceFormModal';
import { InvoiceUploadModal } from '@/components/invoices/InvoiceUploadModal';
import { BulkPaymentModal } from '@/components/invoices/BulkPaymentModal';
import { useInvoiceFilters, PeriodType, InvoiceStatusFilter } from '@/hooks/useInvoiceFilters';
import { formatCurrency } from '@/lib/invoice-utils';

export default function Facturas() {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [bulkPaymentModalOpen, setBulkPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null);

  const queryClient = useQueryClient();
  const { canAccessFinance, loading: rolesLoading } = useUserRole();
  const { assignedClientIds, isLoading: assignedClientsLoading, needsFiltering } = useAssignedClients();
  const { filters, updateFilter, resetFilters, getDateRange, isOverdueFilter } = useInvoiceFilters();

  const { data: clients } = useQuery({
    queryKey: ['clients-for-invoices', needsFiltering, assignedClientIds],
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      
      // Filtrar por clientes asignados si es AM
      if (needsFiltering && assignedClientIds.length > 0) {
        query = query.in('id', assignedClientIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !needsFiltering || assignedClientIds.length > 0,
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', filters, needsFiltering, assignedClientIds, isOverdueFilter],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange();
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, name, code),
          linked_requests:financial_requests!billed_invoice_id(
            id,
            budget:budgets(id, code, title),
            contract:contracts(id, code, title),
            operational_request:operational_requests(
              operational_project:operational_projects(id, name)
            )
          )
        `)
        .order('due_date', { ascending: true, nullsFirst: false });

      // Filtrar por clientes asignados si es AM
      if (needsFiltering && assignedClientIds.length > 0) {
        query = query.in('client_id', assignedClientIds);
      }

      // Special filter: overdue invoices (due_date < today AND status != 'paid')
      if (isOverdueFilter) {
        query = query
          .lt('due_date', today)
          .neq('status', 'paid');
      } else {
        // Normal filters
        if (filters.status) {
          if (filters.status === 'pending') {
            // Pending = all statuses except 'paid'
            query = query.neq('status', 'paid');
          } else {
            query = query.eq('status', filters.status as any);
          }
        }

        if (filters.clientId) {
          query = query.eq('client_id', filters.clientId);
        }

        if (filters.searchTerm) {
          query = query.or(`code.ilike.%${filters.searchTerm}%`);
        }

        // Only apply date filter if not 'all'
        if (filters.periodType !== 'all') {
          if (filters.periodType !== 'custom' || (startDate && endDate)) {
            query = query
              .gte('invoice_date', startDate)
              .lte('invoice_date', endDate);
          }
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !needsFiltering || assignedClientIds.length > 0,
  });

  // Selection derived state (must be above any conditional return to avoid hook-order issues)
  // Selectable = all invoices that are not paid (pending payment)
  const selectableInvoices = useMemo(
    () => (invoices || []).filter((inv) => inv.status !== 'paid'),
    [invoices]
  );

  const selectedInvoices = useMemo(
    () => (invoices || []).filter((inv) => selectedIds.includes(inv.id)),
    [invoices, selectedIds]
  );

  const selectedTotal = useMemo(
    () => selectedInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0),
    [selectedInvoices]
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(selectableInvoices.map((inv) => inv.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleBulkPaymentSuccess = () => {
    setSelectedIds([]);
  };

  const deleteMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Factura eliminada correctamente');
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    },
    onError: (error: any) => {
      toast.error('Error al eliminar: ' + error.message);
    }
  });

  const handleDelete = (invoice: any) => {
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (invoiceToDelete) {
      deleteMutation.mutate(invoiceToDelete.id);
    }
  };

  const canFinance = canAccessFinance();

  if (rolesLoading) {
    return (
      <AppLayout title="Facturas">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Cargando permisos...</p>
        </div>
      </AppLayout>
    );
  }

  if (!canFinance) {
    return (
      <AppLayout title="Facturas">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-destructive">No tienes permisos para acceder a esta sección</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const handleCreate = () => {
    setSelectedInvoice(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEdit = (invoice: any) => {
    setSelectedInvoice(invoice);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleView = (invoice: any) => {
    setSelectedInvoice(invoice);
    setModalMode('view');
    setModalOpen(true);
  };

  const handleUpload = () => {
    setUploadModalOpen(true);
  };

  const hasActiveFilters = filters.searchTerm || filters.status || filters.clientId || isOverdueFilter;

  return (
    <AppLayout title="Gestión de Facturas">
      <div className="space-y-6">
      <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Facturas</h2>
            {isOverdueFilter && (
              <span className="bg-destructive/10 text-destructive text-sm font-medium px-3 py-1 rounded-full">
                Vencidas
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleUpload}>
              <Upload className="h-4 w-4 mr-2" />
              Importar Factura
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Factura
            </Button>
          </div>
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
                  onValueChange={(value) => updateFilter('status', value === 'all' ? null : value as InvoiceStatusFilter)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pending">Pendiente de pago</SelectItem>
                    <SelectItem value="paid">Pagada</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.clientId || 'all'}
                  onValueChange={(value) => updateFilter('clientId', value === 'all' ? null : value)}
                >
                  <SelectTrigger>
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
                  value={filters.periodType}
                  onValueChange={(value) => updateFilter('periodType', value as PeriodType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="this_month">Este mes</SelectItem>
                    <SelectItem value="last_month">Mes pasado</SelectItem>
                    <SelectItem value="this_year">Este año</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filters.periodType === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Input
                      type="date"
                      value={filters.startDate || ''}
                      onChange={(e) => updateFilter('startDate', e.target.value)}
                      placeholder="Desde"
                    />
                  </div>
                  <div>
                    <Input
                      type="date"
                      value={filters.endDate || ''}
                      onChange={(e) => updateFilter('endDate', e.target.value)}
                      placeholder="Hasta"
                    />
                  </div>
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
                      if (!invoices || invoices.length === 0) {
                        toast.error('No hay datos para exportar');
                        return;
                      }
                      exportInvoicesToExcel(invoices, filters);
                      toast.success('Exportando a Excel...');
                    }}
                    disabled={!invoices || invoices.length === 0}
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
          <div className="flex justify-center py-8">
            <p className="text-muted-foreground">Cargando facturas...</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {invoices && invoices.length > 0 ? (
              invoices.map((invoice) => (
                <InvoiceCard
                  key={invoice.id}
                  invoice={invoice}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  canManage={canAccessFinance()}
                />
              ))
            ) : (
              <Card className="col-span-full">
                <CardContent className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground">No hay facturas para mostrar</p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <InvoiceTableView
            invoices={invoices || []}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            canManage={canFinance}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectOne={handleSelectOne}
          />
        )}

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-lg shadow-lg flex items-center gap-4 z-50">
            <span className="font-medium">
              {selectedIds.length} factura{selectedIds.length > 1 ? 's' : ''} seleccionada{selectedIds.length > 1 ? 's' : ''}
            </span>
            <span className="text-primary-foreground/80">|</span>
            <span>{formatCurrency(selectedTotal)}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBulkPaymentModalOpen(true)}
              className="ml-2"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Marcar como Pagadas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <InvoiceFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        invoice={selectedInvoice}
        mode={modalMode}
      />

      <InvoiceUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
      />

      <BulkPaymentModal
        isOpen={bulkPaymentModalOpen}
        onClose={() => setBulkPaymentModalOpen(false)}
        invoices={selectedInvoices}
        onSuccess={handleBulkPaymentSuccess}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`¿Eliminar factura ${invoiceToDelete?.code || ''}?`}
        description="Esta acción no se puede deshacer. Si la factura tiene solicitudes asociadas, estas quedarán sin factura asignada."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </AppLayout>
  );
}
