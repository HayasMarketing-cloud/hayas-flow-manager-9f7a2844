import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { LayoutGrid, Table as TableIcon, Plus, X, Copy, FileText, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBudgetFilters } from '@/hooks/useBudgetFilters';
import { BudgetCard } from '@/components/budgets/BudgetCard';
import { BudgetTableView } from '@/components/budgets/BudgetTableView';
import { useBudgetsInvoicedSummary } from '@/hooks/useBudgetsInvoicedSummary';
import { getEffectiveBudgetStatus } from '@/lib/budget-utils';

import { BudgetFormModal } from '@/components/budgets/BudgetFormModal';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { exportBudgetsToCSV } from '@/utils/excel/budgetsExporter';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useUserRole } from '@/hooks/useUserRole';
import { useCurrentSpecialist } from '@/hooks/useCurrentSpecialist';
import { useUserBudgetIds } from '@/hooks/useAssignedClients';

export default function Presupuestos() {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<any>(null);
  const [associatedData, setAssociatedData] = useState<{
    requests: number;
    projects: number;
    activities: number;
  } | null>(null);
  const [isLoadingAssociatedData, setIsLoadingAssociatedData] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { filters, updateFilter, resetFilters } = useBudgetFilters();
  const queryClient = useQueryClient();
  const { isSpecialist, isAdmin, canAccessFinance, isProjectManager, shouldFilterByAssignment, loading: rolesLoading } = useUserRole();
  const { specialistId, isLoading: specialistLoading } = useCurrentSpecialist();
  const { assignedBudgetIds, isLoading: assignedLoading, needsFiltering } = useUserBudgetIds();
  
  // Check if user is only specialist (no other management roles)
  const isOnlySpecialist = isSpecialist() && !isAdmin() && !canAccessFinance() && !isProjectManager() && !shouldFilterByAssignment();

  const applyDateFilter = (query: any) => {
    if (filters.invoiceYear) {
      if (filters.invoiceMonth) {
        const start = `${filters.invoiceYear}-${String(filters.invoiceMonth).padStart(2, '0')}-01`;
        const endMonth = filters.invoiceMonth === 12 ? 1 : filters.invoiceMonth + 1;
        const endYear = filters.invoiceMonth === 12 ? filters.invoiceYear + 1 : filters.invoiceYear;
        const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
        query = query.gte('estimated_invoice_date', start).lt('estimated_invoice_date', end);
      } else {
        query = query.gte('estimated_invoice_date', `${filters.invoiceYear}-01-01`).lt('estimated_invoice_date', `${filters.invoiceYear + 1}-01-01`);
      }
    }
    return query;
  };

  const { data: allBudgets, isLoading } = useQuery({
    queryKey: ['budgets', filters, isOnlySpecialist, specialistId, needsFiltering, assignedBudgetIds],
    queryFn: async () => {
      const fetchBudgets = async () => {
        // Specialist filtering: get budgets from their items
        if (isOnlySpecialist && specialistId) {
          const { data: budgetItems, error: biError } = await supabase
            .from('budget_items')
            .select('budget_id')
            .eq('specialist_id', specialistId);
          
          if (biError) throw biError;
          
          const budgetIds = [...new Set(budgetItems?.map(bi => bi.budget_id) || [])];
          
          if (budgetIds.length === 0) return [];
          
          let query = supabase
            .from('budgets')
            .select(`*, client:clients(id, name), client_contact:client_contacts(id, name, email)`)
            .in('id', budgetIds)
            .order('created_at', { ascending: false });


          if (filters.clientId) query = query.eq('client_id', filters.clientId);
          if (filters.searchTerm) query = query.or(`title.ilike.%${filters.searchTerm}%`);
          query = applyDateFilter(query);

          const { data, error } = await query;
          if (error) throw error;
          return data || [];
        }
        
        // AM/PM filtering: show only assigned budgets
        if (needsFiltering) {
          if (assignedBudgetIds.length === 0) return [];
          
          let query = supabase
            .from('budgets')
            .select(`*, client:clients(id, name), client_contact:client_contacts(id, name, email), contract:contracts(id, title, code)`)
            .in('id', assignedBudgetIds)
            .order('created_at', { ascending: false });


          if (filters.clientId) query = query.eq('client_id', filters.clientId);
          if (filters.searchTerm) query = query.or(`title.ilike.%${filters.searchTerm}%`);
          query = applyDateFilter(query);

          const { data, error } = await query;
          if (error) throw error;
          return data || [];
        }
        
        // Default query for admin/finanzas
        let query = supabase
          .from('budgets')
          .select(`
            *,
            client:clients(id, name),
            client_contact:client_contacts(id, name, email),
            contract:contracts(id, title, code)
          `)
          .order('created_at', { ascending: false });


        if (filters.clientId) query = query.eq('client_id', filters.clientId);
        if (filters.searchTerm) query = query.or(`title.ilike.%${filters.searchTerm}%`);
        query = applyDateFilter(query);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      };

      const budgetData = await fetchBudgets();
      if (budgetData.length === 0) return [];

      // Fetch creator profiles
      const creatorIds = [...new Set(budgetData.map((b: any) => b.created_by).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', creatorIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return budgetData.map((b: any) => ({
        ...b,
        creator: profileMap.get(b.created_by) || null,
      }));
    },
    enabled: !!user && !rolesLoading && (!isOnlySpecialist || !specialistLoading) && (!needsFiltering || !assignedLoading),
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: invoicedSummaries } = useBudgetsInvoicedSummary(allBudgets);

  const budgets = useMemo(() => {
    if (!allBudgets) return allBudgets;
    if (!filters.invoicedStatus && !filters.status) return allBudgets;
    if (!invoicedSummaries) return allBudgets;
    return allBudgets.filter((b: any) => {
      const s = invoicedSummaries.get(b.id);
      const percent = s?.percent ?? 0;

      if (filters.status) {
        if (filters.status === 'not_fully_invoiced') {
          if (getEffectiveBudgetStatus(b.status, s) === 'invoiced') return false;
        } else if (getEffectiveBudgetStatus(b.status, s) !== filters.status) {
          return false;
        }
      }

      if (!filters.invoicedStatus) return true;
      if (filters.invoicedStatus === 'not_invoiced') return percent <= 0;
      if (filters.invoicedStatus === 'partial') return percent > 0 && percent < 100;
      return percent >= 100;
    });
  }, [allBudgets, invoicedSummaries, filters.invoicedStatus, filters.status]);



  const duplicateMutation = useMutation({
    mutationFn: async (budget: any) => {
      const { data: newBudget, error: budgetError } = await supabase
        .from('budgets')
        .insert({
          title: `${budget.title} (Copia)`,
          client_id: budget.client_id,
          description: budget.description,
          valid_until: budget.valid_until,
          estimated_invoice_date: budget.estimated_invoice_date,
          total_amount: budget.total_amount,
          status: 'pending',
          created_by: user?.id,
          am_user_id: budget.am_user_id,
          pm_user_id: budget.pm_user_id,
          contract_id: budget.contract_id,
        })
        .select()
        .single();

      if (budgetError) throw budgetError;

      const { data: items, error: itemsError } = await supabase
        .from('budget_items')
        .select('*')
        .eq('budget_id', budget.id);

      if (itemsError) throw itemsError;

      if (items && items.length > 0) {
        const itemsToInsert = items.map((item) => ({
          budget_id: newBudget.id,
          service_id: item.service_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          notes: item.notes,
        }));

        const { error: insertError } = await supabase
          .from('budget_items')
          .insert(itemsToInsert);

        if (insertError) throw insertError;
      }

      return newBudget;
    },
    onSuccess: (newBudget) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success(`Presupuesto ${newBudget.code} duplicado correctamente`);
    },
    onError: (error: any) => {
      toast.error('Error al duplicar presupuesto: ' + error.message);
    },
  });

  const convertToContractMutation = useMutation({
    mutationFn: async (budget: any) => {
        const { data: newContract, error: contractError } = await supabase
          .from('contracts')
          .insert({
            title: budget.title,
            client_id: budget.client_id,
            description: budget.description,
            total_amount: budget.total_amount,
            status: 'draft',
            created_by: user?.id,
            am_user_id: budget.am_user_id || null,
            pm_user_id: budget.pm_user_id || null,
          })
        .select()
        .single();

      if (contractError) throw contractError;

      const { data: items, error: itemsError } = await supabase
        .from('budget_items')
        .select('*')
        .eq('budget_id', budget.id);

      if (itemsError) throw itemsError;

      if (items && items.length > 0) {
        const servicesToInsert = items.map((item) => ({
          contract_id: newContract.id,
          service_id: item.service_id,
          description: item.description,
          quantity: item.quantity,
          price_value: item.unit_price,
          billing_frequency: 'monthly' as const,
        }));

        const { error: insertError } = await supabase
          .from('contract_services')
          .insert(servicesToInsert);

        if (insertError) throw insertError;
      }

      return newContract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contrato creado desde presupuesto');
    },
    onError: (error: any) => {
      toast.error('Error al crear contrato: ' + error.message);
    },
  });

  const handleCreate = () => {
    setSelectedBudget(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleView = (budget: any) => {
    navigate(`/presupuestos/${budget.id}`);
  };

  const handleEdit = (budget: any) => {
    setSelectedBudget(budget);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleDelete = async (budget: any) => {
    setBudgetToDelete(budget);
    setIsLoadingAssociatedData(true);
    setDeleteDialogOpen(true);

    try {
      // Obtener datos asociados
      const [requestsRes, projectsRes] = await Promise.all([
        supabase.from('financial_requests').select('id').eq('budget_id', budget.id),
        supabase.from('operational_projects').select('id').eq('budget_id', budget.id),
      ]);

      const requests = requestsRes.data || [];
      const projects = projectsRes.data || [];

      // Obtener actividades de los proyectos
      let activities: any[] = [];
      if (projects.length > 0) {
        const projectIds = projects.map(p => p.id);
        const { data: activitiesData } = await supabase
          .from('operational_requests')
          .select('id')
          .in('operational_project_id', projectIds);
        activities = activitiesData || [];
      }

      setAssociatedData({
        requests: requests.length,
        projects: projects.length,
        activities: activities.length,
      });
    } catch (error) {
      console.error('Error fetching associated data:', error);
      setAssociatedData({ requests: 0, projects: 0, activities: 0 });
    } finally {
      setIsLoadingAssociatedData(false);
    }
  };

  const confirmDelete = async () => {
    if (!budgetToDelete) return;

    try {
      // 1. Obtener proyectos asociados
      const { data: projects } = await supabase
        .from('operational_projects')
        .select('id')
        .eq('budget_id', budgetToDelete.id);

      // 2. Eliminar operational_requests de esos proyectos
      if (projects && projects.length > 0) {
        const projectIds = projects.map(p => p.id);
        await supabase
          .from('operational_requests')
          .delete()
          .in('operational_project_id', projectIds);
      }

      // 3. Eliminar operational_projects
      await supabase
        .from('operational_projects')
        .delete()
        .eq('budget_id', budgetToDelete.id);

      // 4. Eliminar financial_requests
      await supabase
        .from('financial_requests')
        .delete()
        .eq('budget_id', budgetToDelete.id);

      // 5. Eliminar budget_items
      await supabase
        .from('budget_items')
        .delete()
        .eq('budget_id', budgetToDelete.id);

      // 6. Eliminar presupuesto
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budgetToDelete.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
      queryClient.invalidateQueries({ queryKey: ['operational-projects'] });
      toast.success('Presupuesto y datos asociados eliminados correctamente');
    } catch (error: any) {
      toast.error('Error al eliminar presupuesto: ' + error.message);
    } finally {
      setDeleteDialogOpen(false);
      setBudgetToDelete(null);
      setAssociatedData(null);
    }
  };

  const handleDuplicate = (budget: any) => {
    duplicateMutation.mutate(budget);
  };

  const handleConvertToContract = async (budget: any) => {
    if (budget.status !== 'approved') {
      toast.error('Solo se pueden convertir presupuestos aprobados a contratos');
      return;
    }
    convertToContractMutation.mutate(budget);
  };

  const hasActiveFilters = filters.searchTerm || filters.status || filters.clientId || filters.invoiceMonth || filters.invoiceYear || filters.invoicedStatus;

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (!budgets) return;
    setSelectedIds(prev => prev.length === budgets.length ? [] : budgets.map(b => b.id));
  };

  const handleExport = () => {
    if (!budgets) return;
    const toExport = selectedIds.length > 0
      ? budgets.filter(b => selectedIds.includes(b.id))
      : budgets;
    exportBudgetsToCSV(toExport, invoicedSummaries);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
  ];

  return (
    <AppLayout title="Presupuestos" description="Gestión de presupuestos">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold">Presupuestos</h2>
          {!isOnlySpecialist && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Presupuesto
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="relative">
                  <Input
                    placeholder="Buscar por título..."
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
                  onValueChange={(value) => updateFilter('status', value === 'all' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="sent">Enviado</SelectItem>
                    <SelectItem value="approved">Aprobado</SelectItem>
                    <SelectItem value="rejected">Rechazado</SelectItem>
                    <SelectItem value="partially_invoiced">Facturado parcial</SelectItem>
                    <SelectItem value="invoiced">Facturado</SelectItem>
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
                  value={filters.invoiceYear?.toString() || 'all'}
                  onValueChange={(value) => updateFilter('invoiceYear', value === 'all' ? null : parseInt(value))}
                >
                  <SelectTrigger title="Filtra por fecha estimada de facturación (no por período de trabajo)">
                    <SelectValue placeholder="Año a facturar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los años</SelectItem>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.invoiceMonth?.toString() || 'all'}
                  onValueChange={(value) => updateFilter('invoiceMonth', value === 'all' ? null : parseInt(value))}
                  disabled={!filters.invoiceYear}
                >
                  <SelectTrigger title="Filtra por fecha estimada de facturación (no por período de trabajo)">
                    <SelectValue placeholder="Mes a facturar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los meses</SelectItem>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.invoicedStatus || 'all'}
                  onValueChange={(value) => updateFilter('invoicedStatus', value === 'all' ? null : (value as any))}
                >
                  <SelectTrigger title="Filtra por estado de facturación real (facturas emitidas)">
                    <SelectValue placeholder="Estado facturación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Facturado: todos</SelectItem>
                    <SelectItem value="not_invoiced">Sin facturar (0%)</SelectItem>
                    <SelectItem value="partial">Parcialmente facturado</SelectItem>
                    <SelectItem value="invoiced">Facturado (100%)</SelectItem>
                  </SelectContent>
                </Select>


              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      <X className="h-4 w-4 mr-2" />
                      Limpiar filtros
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedIds.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {selectedIds.length} seleccionado(s)
                    </span>
                  )}
                  <Button variant="outline" size="sm" onClick={handleExport} disabled={!budgets || budgets.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    {selectedIds.length > 0 ? `Exportar (${selectedIds.length})` : 'Exportar CSV'}
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
        ) : !budgets || budgets.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={hasActiveFilters ? 'No se encontraron presupuestos' : '¡Crea tu primer presupuesto!'}
            description={
              hasActiveFilters
                ? 'No hay presupuestos que coincidan con los filtros aplicados. Intenta ajustar tus criterios de búsqueda.'
                : 'Los presupuestos te permiten cotizar servicios a tus clientes. Una vez aprobados, puedes convertirlos en contratos.'
            }
            action={
              !hasActiveFilters
                ? {
                    label: 'Crear Presupuesto',
                    onClick: handleCreate,
                    icon: Plus,
                  }
                : undefined
            }
          >
            {hasActiveFilters && (
              <Button variant="outline" onClick={resetFilters} className="mt-4">
                Limpiar Filtros
              </Button>
            )}
          </EmptyState>
        ) : viewMode === 'cards' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                onView={handleView}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onConvertToContract={handleConvertToContract}
                onDelete={handleDelete}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ['budgets'] })}
                invoicedSummary={invoicedSummaries?.get(budget.id)}

              />
            ))}
          </div>
        ) : (
          <BudgetTableView
            budgets={budgets}
            invoicedSummaries={invoicedSummaries}

            onView={handleView}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            selectedIds={selectedIds}
            onSelectOne={handleSelectOne}
            onSelectAll={handleSelectAll}
          />
        )}
      </div>

      <BudgetFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedBudget(null);
        }}
        budget={selectedBudget}
        mode={modalMode}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setBudgetToDelete(null);
            setAssociatedData(null);
          }
        }}
        title="Eliminar Presupuesto"
        description={
          isLoadingAssociatedData
            ? 'Cargando información...'
            : associatedData && (associatedData.requests > 0 || associatedData.projects > 0)
            ? `¿Estás seguro de eliminar "${budgetToDelete?.title}"?\n\nSe eliminarán también:\n• ${associatedData.requests} solicitud(es) financiera(s)\n• ${associatedData.projects} proyecto(s) operacional(es)\n• ${associatedData.activities} actividad(es) del proyecto\n\nEsta acción no se puede deshacer.`
            : `¿Estás seguro de eliminar "${budgetToDelete?.title}"? Esta acción no se puede deshacer.`
        }
        confirmText="Eliminar Todo"
        cancelText="Cancelar"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </AppLayout>
  );
}
