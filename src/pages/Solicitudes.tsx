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
import { Plus, Search, LayoutGrid, Table as TableIcon, Download, Trash2, Receipt, FileText, X, User } from 'lucide-react';
import { exportRequestsToExcel } from '@/utils/excel/requestsExporter';
import { toast } from 'sonner';
import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RequestFormModal } from '@/components/modals/RequestFormModal';
import { RequestCard } from '@/components/requests/RequestCard';
import { RequestTableView } from '@/components/requests/RequestTableView';
import { useRequestFilters } from '@/hooks/useRequestFilters';
import { useUserRole } from '@/hooks/useUserRole';
import { useCurrentSpecialist } from '@/hooks/useCurrentSpecialist';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AddToLiquidationModal } from '@/components/liquidations/AddToLiquidationModal';
import { AddToInvoiceModal } from '@/components/invoices/AddToInvoiceModal';
import { useRequestActivityLog } from '@/hooks/useRequestActivityLog';

const Solicitudes = () => {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<any>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [addToLiquidationOpen, setAddToLiquidationOpen] = useState(false);
  const [addToInvoiceOpen, setAddToInvoiceOpen] = useState(false);
  const [bulkEditConfirmOpen, setBulkEditConfirmOpen] = useState(false);
  const [pendingBulkEdit, setPendingBulkEdit] = useState<{ field: string; value: any; label: string } | null>(null);
  const queryClient = useQueryClient();
  const { filters, updateFilter, resetFilters } = useRequestFilters();
  const { canAccessFinance, canAccessOperations, isSpecialist, loading: rolesLoading } = useUserRole();
  const { specialistId } = useCurrentSpecialist();
  const { logActivity } = useRequestActivityLog();
  const canManage = canAccessFinance() || canAccessOperations();
  const showMyRequestsButton = isSpecialist() && !!specialistId;

  const { data: requests, isLoading, error } = useQuery({
    queryKey: ['financial_requests', filters],
    queryFn: async () => {
      // Build filters object - exclude virtual statuses from match filters
      const queryFilters: Record<string, string> = {};
      const virtualStatuses = ['liquidated', 'pending_liquidation'];
      if (filters.status && !virtualStatuses.includes(filters.status)) {
        queryFilters.status = filters.status;
      }
      if (filters.clientId) queryFilters.client_id = filters.clientId;
      if (filters.specialistId) queryFilters.specialist_id = filters.specialistId;
      if (filters.budgetId) queryFilters.budget_id = filters.budgetId;
      if (filters.contractId) queryFilters.contract_id = filters.contractId;
      if (filters.partnerReference) queryFilters.partner_reference = filters.partnerReference;

      let query = supabase
        .from('financial_requests')
        .select(
          `
          *,
          client:clients(id, name, code),
          service:services(id, name),
          specialist:specialists(id, name),
          budget:budgets(id, title, code, client_contact_id),
          contract:contracts(id, title, code),
          invoice:invoices(id, code, status),
          liquidation:liquidations(id, code, status),
          client_contact:client_contacts(id, name),
          operational_request:operational_requests!financial_request_id(
            id,
            operational_project:operational_projects(id, name)
          )
        `
        )
        .match(queryFilters)
        .order('created_at', { ascending: false });

      // Apply virtual status filters
      if (filters.status === 'liquidated') {
        // Requests with liquidation_id assigned
        query = query.not('liquidation_id', 'is', null);
      } else if (filters.status === 'pending_liquidation') {
        // All requests without liquidation_id, except cancelled ones
        query = query.is('liquidation_id', null).neq('status', 'cancelled');
      }
      // Apply year/month filters based on created_at
      if (filters.year) {
        const startDate = new Date(filters.year, filters.month ? filters.month - 1 : 0, 1);
        const endDate = filters.month 
          ? new Date(filters.year, filters.month, 0, 23, 59, 59, 999)
          : new Date(filters.year, 11, 31, 23, 59, 59, 999);
        
        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
      }

      // Apply work period filters (work_month/work_year)
      if (filters.workYear) {
        query = query.eq('work_year', filters.workYear);
        if (filters.workMonth) {
          query = query.eq('work_month', filters.workMonth);
        }
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

  // Fetch budgets - either filtered by client or fetch specific budget by ID
  const { data: budgets } = useQuery({
    queryKey: ['budgets-filter', filters.clientId, filters.budgetId],
    queryFn: async () => {
      // If we have a budgetId from URL but no client, fetch that specific budget
      if (filters.budgetId && !filters.clientId) {
        const { data, error } = await supabase
          .from('budgets')
          .select('id, title, code, client_id')
          .eq('id', filters.budgetId);
        if (error) throw error;
        return data;
      }
      
      // If client is selected, fetch all budgets for that client
      if (filters.clientId) {
        const { data, error } = await supabase
          .from('budgets')
          .select('id, title, code')
          .eq('client_id', filters.clientId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      }
      
      return [];
    },
    enabled: !!filters.clientId || !!filters.budgetId,
  });

  // Fetch contracts - either filtered by client or fetch specific contract by ID
  const { data: contracts } = useQuery({
    queryKey: ['contracts-filter', filters.clientId, filters.contractId],
    queryFn: async () => {
      // If we have a contractId from URL but no client, fetch that specific contract
      if (filters.contractId && !filters.clientId) {
        const { data, error } = await supabase
          .from('contracts')
          .select('id, title, code, client_id')
          .eq('id', filters.contractId);
        if (error) throw error;
        return data;
      }
      
      // If client is selected, fetch all contracts for that client
      if (filters.clientId) {
        const { data, error } = await supabase
          .from('contracts')
          .select('id, title, code')
          .eq('client_id', filters.clientId)
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      }
      
      return [];
    },
    enabled: !!filters.clientId || !!filters.contractId,
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
      toast.error('Error al eliminar el request');
    } else {
      toast.success('Request eliminado correctamente');
      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
    }
    setDeleteConfirmOpen(false);
    setRequestToDelete(null);
  };

  const handleCloneRequest = async (request: any) => {
    // Exclude all relational and auto-generated fields
    const { 
      id, 
      code, 
      created_at, 
      updated_at, 
      client, 
      service, 
      specialist, 
      budget,
      invoice,
      contract,
      budget_item,
      client_contact,
      liquidation,
      billed_invoice_id,
      liquidation_id,
      completed_at,
      operational_request, // Exclude the joined operational_request relation
      billed_invoice, // Exclude joined relation
      ...cloneData 
    } = request;

    // Generate a new code using the sequence
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
      console.error('Clone error:', error);
      toast.error('Error al clonar el request: ' + error.message);
    } else {
      // Log the clone activity
      if (newRequest?.id) {
        await logActivity({
          entityId: newRequest.id,
          action: 'cloned',
          changes: { from_code: code, from_id: id }
        });
      }
      toast.success('Request clonado correctamente');
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
      toast.error('Error al desvincular requests operativos');
      setBulkDeleteConfirmOpen(false);
      return;
    }

    // Then delete the financial requests
    const { error } = await supabase
      .from('financial_requests')
      .delete()
      .in('id', selectedIds);

    if (error) {
      toast.error('Error al eliminar los requests');
    } else {
      toast.success(`${selectedIds.length} requests eliminados`);
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

  const handleAddToLiquidation = (request: any) => {
    setSelectedIds([request.id]);
    setAddToLiquidationOpen(true);
  };

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: any }) => {
      // Special handling for cost_rate: recalculate cost_to_agency based on hours
      if (field === 'cost_rate') {
        // Get selected requests with their hours
        const selectedRequests = requests?.filter(r => selectedIds.includes(r.id)) || [];
        
        // Update each request individually with recalculated cost_to_agency
        for (const request of selectedRequests) {
          const hours = request.hours || 0;
          const newCostToAgency = value * hours;
          
          const { error } = await supabase
            .from('financial_requests')
            .update({ 
              cost_rate: value,
              cost_to_agency: newCostToAgency 
            })
            .eq('id', request.id);
          
          if (error) throw error;
        }
      } else if (field === 'unit_price') {
        // Special handling for unit_price: recalculate sale_amount based on quantity
        const selectedRequests = requests?.filter(r => selectedIds.includes(r.id)) || [];
        
        for (const request of selectedRequests) {
          const quantity = request.quantity || 1;
          const newSaleAmount = value * quantity;
          
          const { error } = await supabase
            .from('financial_requests')
            .update({ 
              unit_price: value,
              sale_amount: newSaleAmount,
              sale_type: 'fixed'
            })
            .eq('id', request.id);
          
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from('financial_requests')
          .update({ [field]: value })
          .in('id', selectedIds);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Requests actualizados correctamente');
      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
      setSelectedIds([]);
      setBulkEditConfirmOpen(false);
      setPendingBulkEdit(null);
    },
    onError: () => {
      toast.error('Error al actualizar los requests');
      setBulkEditConfirmOpen(false);
      setPendingBulkEdit(null);
    },
  });

  const confirmBulkEdit = (field: string, value: any, label: string) => {
    setPendingBulkEdit({ field, value, label });
    setBulkEditConfirmOpen(true);
  };

  const executeBulkEdit = () => {
    if (pendingBulkEdit) {
      bulkUpdateMutation.mutate({ field: pendingBulkEdit.field, value: pendingBulkEdit.value });
    }
  };

  if (error) {
    return (
      <AppLayout title="Requests" description="Gestión de requests de servicios">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-destructive">Error al cargar requests: {String(error?.message || 'Error desconocido')}</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Requests" description="Gestión de requests de servicios">
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
                  Nuevo Request
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Botón Mis Requests para especialistas */}
            {showMyRequestsButton && (
              <Button
                variant={filters.specialistId === specialistId ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  if (filters.specialistId === specialistId) {
                    updateFilter('specialistId', null);
                  } else {
                    updateFilter('specialistId', specialistId!);
                  }
                }}
                className="gap-2"
              >
                <User className="h-4 w-4" />
                Mis Requests
              </Button>
            )}

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
                <SelectItem value="pending_specialist">Pend. Especialista</SelectItem>
                <SelectItem value="pending_approval">Pend. Aprobación</SelectItem>
                <SelectItem value="in_progress">En Progreso</SelectItem>
                <SelectItem value="pending_review">Pend. Revisión</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="pending_liquidation">Pend. Liquidar</SelectItem>
                <SelectItem value="liquidated">Liquidado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
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

            {/* Budget filter - shown when client is selected OR when budget_id is in URL */}
            {(filters.clientId || filters.budgetId) && (
              <Select
                value={filters.budgetId || 'all'}
                onValueChange={(value) =>
                  updateFilter('budgetId', value === 'all' ? null : value)
                }
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Todos los presupuestos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los presupuestos</SelectItem>
                  {budgets?.map((budget) => (
                    <SelectItem key={budget.id} value={budget.id}>
                      {budget.code} - {budget.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Contract filter - shown when client is selected OR when contractId is in URL */}
            {(filters.clientId || filters.contractId) && (
              <Select
                value={filters.contractId || 'all'}
                onValueChange={(value) =>
                  updateFilter('contractId', value === 'all' ? null : value)
                }
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Todos los contratos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los contratos</SelectItem>
                  {contracts?.map((contract) => (
                    <SelectItem key={contract.id} value={contract.id}>
                      {contract.code} - {contract.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Período creación (combined year+month) */}
            <Select
              value={
                filters.year && filters.month
                  ? `${filters.year}-${filters.month}`
                  : 'all'
              }
              onValueChange={(value) => {
                if (value === 'all') {
                  updateFilter('year', null);
                  updateFilter('month', null);
                } else {
                  const [y, m] = value.split('-').map(Number);
                  updateFilter('month', m);
                  updateFilter('year', y);
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Período creación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los períodos</SelectItem>
                {(() => {
                  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                  const now = new Date();
                  return Array.from({ length: 18 }, (_, i) => {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const val = `${d.getFullYear()}-${d.getMonth() + 1}`;
                    return (
                      <SelectItem key={val} value={val}>
                        {months[d.getMonth()]} {d.getFullYear()}
                      </SelectItem>
                    );
                  });
                })()}
              </SelectContent>
            </Select>

            {/* Mes trabajo (combined workYear+workMonth) */}
            <Select
              value={
                filters.workYear && filters.workMonth
                  ? `${filters.workYear}-${filters.workMonth}`
                  : 'all'
              }
              onValueChange={(value) => {
                if (value === 'all') {
                  updateFilter('workYear', null);
                  updateFilter('workMonth', null);
                } else {
                  const [y, m] = value.split('-').map(Number);
                  updateFilter('workMonth', m);
                  updateFilter('workYear', y);
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Mes trabajo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {(() => {
                  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                  const now = new Date();
                  return Array.from({ length: 18 }, (_, i) => {
                    const d = new Date(now.getFullYear(), now.getMonth() + 1 - i, 1);
                    const val = `${d.getFullYear()}-${d.getMonth() + 1}`;
                    return (
                      <SelectItem key={val} value={val}>
                        {months[d.getMonth()]} {d.getFullYear()}
                      </SelectItem>
                    );
                  });
                })()}
              </SelectContent>
            </Select>

            {(filters.status || filters.clientId || filters.specialistId || filters.budgetId || filters.contractId || filters.searchTerm || filters.year || filters.partnerReference || filters.workYear) && (
              <Button variant="outline" onClick={resetFilters}>
                <X className="h-4 w-4 mr-2" />
                Limpiar filtros
              </Button>
            )}

            {/* Partner Reference filter - show as text input for searching */}
            <div className="relative max-w-[200px]">
              <Input
                placeholder="Ref. Partner..."
                value={filters.partnerReference || ''}
                onChange={(e) => updateFilter('partnerReference', e.target.value || null)}
                className="h-10"
              />
            </div>
          </div>
        </div>

        {/* Barra de acciones en grupo */}
        {selectedIds.length > 0 && viewMode === 'table' && (
          <div className="flex flex-wrap items-center gap-4 p-3 bg-muted rounded-md">
            <span className="text-sm font-medium">{selectedIds.length} seleccionados</span>
            
            <div className="h-4 w-px bg-border" />
            
            {/* Estado */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Estado:</span>
              <Select 
                onValueChange={(value) => {
                  const labels: Record<string, string> = {
                    draft: 'Borrador',
                    pending_specialist: 'Pend. Especialista',
                    pending_approval: 'Pend. Aprobación',
                    in_progress: 'En Progreso',
                    pending_review: 'Pend. Revisión',
                    completed: 'Completado',
                    cancelled: 'Cancelado',
                  };
                  confirmBulkEdit('status', value, labels[value] || value);
                }}
              >
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="Cambiar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="pending_specialist">Pend. Especialista</SelectItem>
                  <SelectItem value="pending_approval">Pend. Aprobación</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="pending_review">Pend. Revisión</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Fecha */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Fecha:</span>
              <Input
                type="date"
                className="w-[140px] h-8"
                onChange={(e) => {
                  if (e.target.value) {
                    confirmBulkEdit('deadline', e.target.value, e.target.value);
                  }
                }}
              />
            </div>
            
            {/* Tarifa por hora (cost_rate) */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tarifa/hora:</span>
              <Input
                id="bulk-cost-rate-input"
                type="number"
                placeholder="0.00"
                className="w-[100px] h-8"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = parseFloat((e.target as HTMLInputElement).value);
                    if (!isNaN(value) && value >= 0) {
                      confirmBulkEdit('cost_rate', value, `${value.toFixed(2)} €/h (recalcula coste total)`);
                    }
                  }
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  const input = document.getElementById('bulk-cost-rate-input') as HTMLInputElement;
                  const value = parseFloat(input?.value || '');
                  if (!isNaN(value) && value >= 0) {
                    confirmBulkEdit('cost_rate', value, `${value.toFixed(2)} €/h (recalcula coste total)`);
                  } else {
                    toast.error('Introduce una tarifa válida');
                  }
                }}
              >
                Aplicar
              </Button>
            </div>
            
            {/* Precio unitario (unit_price) */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Precio unit.:</span>
              <Input
                id="bulk-unit-price-input"
                type="number"
                placeholder="0.00"
                className="w-[100px] h-8"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = parseFloat((e.target as HTMLInputElement).value);
                    if (!isNaN(value) && value >= 0) {
                      confirmBulkEdit('unit_price', value, `${value.toFixed(2)} € (recalcula importe venta)`);
                    }
                  }
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  const input = document.getElementById('bulk-unit-price-input') as HTMLInputElement;
                  const value = parseFloat(input?.value || '');
                  if (!isNaN(value) && value >= 0) {
                    confirmBulkEdit('unit_price', value, `${value.toFixed(2)} € (recalcula importe venta)`);
                  } else {
                    toast.error('Introduce un precio válido');
                  }
                }}
              >
                Aplicar
              </Button>
            </div>
            
            <div className="h-4 w-px bg-border" />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddToLiquidationOpen(true)}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Añadir a Liquidación
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddToInvoiceOpen(true)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Añadir a Facturación
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedIds([])} 
              className="ml-auto"
            >
              <X className="h-4 w-4 mr-1" />
              Limpiar
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
                  onAddToLiquidation={handleAddToLiquidation}
                  canManage={canManage}
                  onRefresh={handleSuccess}
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
              onRefresh={handleSuccess}
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
        title="Eliminar request"
        description={`¿Estás seguro de eliminar el request "${requestToDelete?.title}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        onConfirm={() => requestToDelete && handleDeleteRequest(requestToDelete.id)}
        variant="destructive"
      />

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onOpenChange={setBulkDeleteConfirmOpen}
        title="Eliminar requests"
        description={`¿Estás seguro de eliminar ${selectedIds.length} requests? Esta acción no se puede deshacer.`}
        confirmText="Eliminar todas"
        onConfirm={handleBulkDelete}
        variant="destructive"
      />

      <ConfirmDialog
        open={bulkEditConfirmOpen}
        onOpenChange={(open) => {
          setBulkEditConfirmOpen(open);
          if (!open) setPendingBulkEdit(null);
        }}
        title="Confirmar cambio masivo"
        description={`¿Estás seguro de cambiar ${pendingBulkEdit?.field === 'status' ? 'el estado' : pendingBulkEdit?.field === 'deadline' ? 'la fecha' : 'el coste'} a "${pendingBulkEdit?.label}" en ${selectedIds.length} requests?`}
        confirmText="Aplicar cambio"
        onConfirm={executeBulkEdit}
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

      <AddToInvoiceModal
        open={addToInvoiceOpen}
        onOpenChange={setAddToInvoiceOpen}
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
