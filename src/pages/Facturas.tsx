import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LayoutGrid, Table as TableIcon, X, Download, Upload, CreditCard, Undo2, Check, ChevronsUpDown, FileStack } from 'lucide-react';
import { GenerateDraftInvoicesModal } from '@/components/invoices/GenerateDraftInvoicesModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
import { PaymentRegistrationModal } from '@/components/invoices/PaymentRegistrationModal';
import { useInvoiceFilters, PeriodType, InvoiceStatusFilter } from '@/hooks/useInvoiceFilters';
import { formatCurrency } from '@/lib/invoice-utils';
import { PaymentsTableView } from '@/components/invoices/PaymentsTableView';

export default function Facturas() {
  const [activeTab, setActiveTab] = useState('invoices');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [bulkPaymentModalOpen, setBulkPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [generateDraftsOpen, setGenerateDraftsOpen] = useState(false);

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
          budget:budgets(id, code, title),
          contract:contracts(id, code, title),
          invoice_budget_allocations(
            id,
            budget_id,
            allocated_amount,
            budget:budgets(id, code, title)
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

      if (filters.clientIds.length > 0) {
          query = query.in('client_id', filters.clientIds);
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
  // Selectable = all invoices (including paid ones for reverting)
  const selectableInvoices = useMemo(
    () => invoices || [],
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

  // Check if selected invoices contain paid or unpaid for conditional buttons
  const hasSelectedPaid = useMemo(
    () => selectedInvoices.some(inv => inv.status === 'paid'),
    [selectedInvoices]
  );
  const hasSelectedUnpaid = useMemo(
    () => selectedInvoices.some(inv => inv.status !== 'paid'),
    [selectedInvoices]
  );
  const selectedPaidInvoices = useMemo(
    () => selectedInvoices.filter(inv => inv.status === 'paid'),
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

  // Mutation to revert paid invoices to sent status
  const revertMutation = useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      // Delete invoice_payments links for these invoices
      const { error: deleteError } = await supabase
        .from('invoice_payments')
        .delete()
        .in('invoice_id', invoiceIds);
      
      if (deleteError) throw deleteError;

      // Update invoices to 'sent' status and clear paid_at
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'sent', paid_at: null })
        .in('id', invoiceIds);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-payments'] });
      toast.success('Facturas revertidas a Pendiente de cobro');
      setSelectedIds([]);
      setRevertDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error('Error al revertir: ' + error.message);
    }
  });

  const handleBulkRevert = () => {
    setRevertDialogOpen(true);
  };

  const confirmBulkRevert = () => {
    const paidIds = selectedPaidInvoices.map(inv => inv.id);
    if (paidIds.length > 0) {
      revertMutation.mutate(paidIds);
    }
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

  const hasActiveFilters = filters.searchTerm || filters.status || filters.clientIds.length > 0 || isOverdueFilter;

  return (
    <AppLayout title="Gestión de Facturas">
      <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <TabsList>
              <TabsTrigger value="invoices">Facturas</TabsTrigger>
              <TabsTrigger value="payments">Cobros</TabsTrigger>
            </TabsList>
            {isOverdueFilter && activeTab === 'invoices' && (
              <span className="bg-destructive/10 text-destructive text-sm font-medium px-3 py-1 rounded-full">
                Vencidas
              </span>
            )}
          </div>
          {activeTab === 'invoices' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setGenerateDraftsOpen(true)}>
                <FileStack className="h-4 w-4 mr-2" />
                Generar borradores del mes…
              </Button>
              <Button variant="outline" onClick={handleUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Importar Factura
              </Button>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Factura
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="invoices" className="space-y-6 mt-4">
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
                      <SelectItem value="pending">Pendiente de cobro</SelectItem>
                      <SelectItem value="paid">Cobrada</SelectItem>
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="justify-between h-10 font-normal"
                      >
                        {filters.clientIds.length === 0
                          ? 'Todos los clientes'
                          : filters.clientIds.length === 1
                            ? clients?.find(c => c.id === filters.clientIds[0])?.name || '1 cliente'
                            : `${filters.clientIds.length} clientes`}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar cliente..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                          <CommandGroup>
                            {clients?.map((client) => {
                              const isSelected = filters.clientIds.includes(client.id);
                              return (
                                <CommandItem
                                  key={client.id}
                                  value={client.name}
                                  onSelect={() => {
                                    const newIds = isSelected
                                      ? filters.clientIds.filter(id => id !== client.id)
                                      : [...filters.clientIds, client.id];
                                    updateFilter('clientIds', newIds);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      isSelected ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {client.name}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

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
              
              {/* Revert to pending - only for paid invoices */}
              {hasSelectedPaid && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBulkRevert}
                  className="ml-2"
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Revertir a Pendiente {selectedPaidInvoices.length < selectedIds.length ? `(${selectedPaidInvoices.length})` : ''}
                </Button>
              )}
              
              {/* Mark as paid - only for unpaid invoices */}
              {hasSelectedUnpaid && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setBulkPaymentModalOpen(true)}
                  className="ml-2"
                  disabled={hasSelectedPaid}
                  title={hasSelectedPaid ? 'No se puede registrar cobro para facturas ya cobradas' : ''}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Marcar como Cobradas
                </Button>
              )}
              
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
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <PaymentsTableView />
        </TabsContent>
      </Tabs>
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

      <PaymentRegistrationModal
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

      <ConfirmDialog
        open={revertDialogOpen}
        onOpenChange={setRevertDialogOpen}
        title={`¿Revertir ${selectedPaidInvoices.length} factura${selectedPaidInvoices.length > 1 ? 's' : ''} a Pendiente de cobro?`}
        description="Se eliminarán los vínculos con pagos registrados y las facturas volverán al estado 'Enviada'. Podrás volver a registrar un cobro para asociarlas a un nuevo pago."
        confirmText="Revertir"
        cancelText="Cancelar"
        onConfirm={confirmBulkRevert}
      />

      <GenerateDraftInvoicesModal
        open={generateDraftsOpen}
        onOpenChange={setGenerateDraftsOpen}
      />
    </AppLayout>
  );
}
