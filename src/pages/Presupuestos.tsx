import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { LayoutGrid, Table as TableIcon, Plus, X, Copy, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBudgetFilters } from '@/hooks/useBudgetFilters';
import { BudgetCard } from '@/components/budgets/BudgetCard';
import { BudgetTableView } from '@/components/budgets/BudgetTableView';
import { BudgetFormModal } from '@/components/budgets/BudgetFormModal';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useUserRole } from '@/hooks/useUserRole';
import { useCurrentSpecialist } from '@/hooks/useCurrentSpecialist';
import { useUserBudgetIds } from '@/hooks/useAssignedClients';

export default function Presupuestos() {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
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

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets', filters, isOnlySpecialist, specialistId, needsFiltering, assignedBudgetIds],
    queryFn: async () => {
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
          .select(`*, client:clients(id, name)`)
          .in('id', budgetIds)
          .order('created_at', { ascending: false });

        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.clientId) {
          query = query.eq('client_id', filters.clientId);
        }
        if (filters.searchTerm) {
          query = query.or(`title.ilike.%${filters.searchTerm}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
      }
      
      // AM/PM filtering: show only assigned budgets
      if (needsFiltering) {
        if (assignedBudgetIds.length === 0) return [];
        
        let query = supabase
          .from('budgets')
          .select(`*, client:clients(id, name)`)
          .in('id', assignedBudgetIds)
          .order('created_at', { ascending: false });

        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.clientId) {
          query = query.eq('client_id', filters.clientId);
        }
        if (filters.searchTerm) {
          query = query.or(`title.ilike.%${filters.searchTerm}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
      }
      
      // Default query for admin/finanzas
      let query = supabase
        .from('budgets')
        .select(`
          *,
          client:clients(id, name)
        `)
        .order('created_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters.searchTerm) {
        query = query.or(`title.ilike.%${filters.searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
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

  const hasActiveFilters = filters.searchTerm || filters.status || filters.clientId;

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              />
            ))}
          </div>
        ) : (
          <BudgetTableView
            budgets={budgets}
            onView={handleView}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
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
