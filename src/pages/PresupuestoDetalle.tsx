import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Edit, Copy, FileText, Save, X, Loader2, CheckCircle, ListPlus, Trash2, CloudOff, Cloud } from 'lucide-react';
import { useBudgetDetail } from '@/hooks/useBudgetDetail';
import { BudgetStatusBadge } from '@/components/budgets/BudgetStatusBadge';
import { BudgetItemsEditor } from '@/components/budgets/BudgetItemsEditor';
import { formatCurrency, getBudgetStatusLabel, calculateBudgetTotal } from '@/lib/budget-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import { BudgetFormModal } from '@/components/budgets/BudgetFormModal';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApproveBudget } from '@/hooks/useApproveBudget';
import { ProjectCreationModal } from '@/components/budgets/ProjectCreationModal';
import { useCreateProjectWithActivities } from '@/hooks/useCreateProjectWithActivities';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function PresupuestoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useBudgetDetail(id);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isEditingDocUrl, setIsEditingDocUrl] = useState(false);
  const [docUrlInput, setDocUrlInput] = useState('');
  
  // Estados para flujo de aprobación
  const [showProjectModal, setShowProjectModal] = useState(false);
  
  // Estados para eliminación
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [associatedData, setAssociatedData] = useState<{
    requests: number;
    projects: number;
    activities: number;
  } | null>(null);
  const [isLoadingAssociatedData, setIsLoadingAssociatedData] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Hooks de aprobación y creación de proyecto con actividades
  const approveMutation = useApproveBudget();
  const createProjectWithActivities = useCreateProjectWithActivities();

  // Query para verificar si el presupuesto tiene financial_requests
  const { data: existingRequests } = useQuery({
    queryKey: ['budget-requests', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_requests')
        .select('id')
        .eq('budget_id', id);
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // Query para verificar si el presupuesto tiene operational_projects
  const { data: existingProjects } = useQuery({
    queryKey: ['budget-projects', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operational_projects')
        .select('id')
        .eq('budget_id', id);
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const hasFinancialRequests = existingRequests && existingRequests.length > 0;
  const hasOperationalProjects = existingProjects && existingProjects.length > 0;
  const hasAssociatedDataForStatusChange = hasFinancialRequests || hasOperationalProjects;

  // Función para preparar eliminación
  const handleDeleteClick = async () => {
    if (!id) return;
    setIsLoadingAssociatedData(true);
    setDeleteDialogOpen(true);

    try {
      const [requestsRes, projectsRes] = await Promise.all([
        supabase.from('financial_requests').select('id').eq('budget_id', id),
        supabase.from('operational_projects').select('id').eq('budget_id', id),
      ]);

      const requests = requestsRes.data || [];
      const projects = projectsRes.data || [];

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

  // Función para confirmar eliminación en cascada
  const confirmDelete = async () => {
    if (!id) return;
    setIsDeleting(true);

    try {
      // 1. Obtener proyectos asociados
      const { data: projects } = await supabase
        .from('operational_projects')
        .select('id')
        .eq('budget_id', id);

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
        .eq('budget_id', id);

      // 4. Eliminar financial_requests
      await supabase
        .from('financial_requests')
        .delete()
        .eq('budget_id', id);

      // 5. Eliminar budget_items
      await supabase
        .from('budget_items')
        .delete()
        .eq('budget_id', id);

      // 6. Eliminar presupuesto
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Presupuesto y datos asociados eliminados correctamente');
      navigate('/presupuestos');
    } catch (error: any) {
      toast.error('Error al eliminar: ' + error.message);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setAssociatedData(null);
    }
  };

  // Mutación para generar solicitudes sin cambiar estado (para presupuestos ya aprobados)
  const generateRequestsMutation = useMutation({
    mutationFn: async () => {
      if (!data?.budget || !data?.items || data.items.length === 0) {
        throw new Error('No hay items en el presupuesto');
      }

      const itemsWithoutService = data.items.filter((item: any) => !item.service_id);
      if (itemsWithoutService.length > 0) {
        throw new Error('Hay líneas sin servicio asignado');
      }

      const requestsToInsert = data.items.map((item: any) => ({
        title: item.description,
        description: `Generado desde presupuesto: ${data.budget.title}`,
        client_id: data.budget.client_id,
        service_id: item.service_id,
        budget_id: data.budget.id,
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
        sale_amount: item.total || 0,
        status: 'active' as const,
        code: '',
      }));

      const { error } = await supabase
        .from('financial_requests')
        .insert(requestsToInsert);

      if (error) throw error;
      return requestsToInsert.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['budget-requests', id] });
      queryClient.invalidateQueries({ queryKey: ['budget-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
      toast.success(`${count} solicitud(es) financiera(s) creada(s)`);
      setShowProjectModal(true);
    },
    onError: (error: any) => {
      toast.error('Error: ' + error.message);
    }
  });

  // Estados para edición inline de Resumen
  const [isEditingResumen, setIsEditingResumen] = useState(false);
  const [resumenFormData, setResumenFormData] = useState({
    title: '',
    client_id: '',
    description: '',
    valid_until: '',
  });
  const [isSavingResumen, setIsSavingResumen] = useState(false);

  // Estados para edición inline de Detalle Económico
  const [isEditingEconomico, setIsEditingEconomico] = useState(false);
  const [economicItems, setEconomicItems] = useState<any[]>([]);
  const [isSavingEconomico, setIsSavingEconomico] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Cargar clientes para el select
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

  // Inicializar datos de resumen cuando cambian los datos
  useEffect(() => {
    if (data?.budget) {
      setResumenFormData({
        title: data.budget.title || '',
        client_id: data.budget.client_id || '',
        description: data.budget.description || '',
        valid_until: data.budget.valid_until || '',
      });
    }
  }, [data?.budget]);

  // Inicializar items económicos cuando cambian los datos
  useEffect(() => {
    if (data?.items) {
      setEconomicItems(data.items);
      setHasUnsavedChanges(false);
    }
  }, [data?.items]);

  // Función de autoguardado silencioso
  const performAutoSave = async () => {
    if (!data?.budget || !isEditingEconomico || !hasUnsavedChanges) return;
    
    // No autoguardar si hay validaciones pendientes
    if (economicItems.length === 0) return;
    if (economicItems.some((item) => !item.service_id)) return;

    setAutoSaveStatus('saving');
    const newTotal = calculateBudgetTotal(economicItems);

    try {
      // Eliminar items antiguos
      await supabase.from('budget_items').delete().eq('budget_id', data.budget.id);

      // Insertar nuevos items con specialist_id
      const itemsToInsert = economicItems.map((item) => ({
        budget_id: data.budget.id,
        service_id: item.service_id,
        specialist_id: item.specialist_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from('budget_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Actualizar total_amount en budget
      const { error: budgetError } = await supabase
        .from('budgets')
        .update({ total_amount: newTotal })
        .eq('id', data.budget.id);

      if (budgetError) throw budgetError;

      setLastAutoSave(new Date());
      setHasUnsavedChanges(false);
      setAutoSaveStatus('saved');
      
      // Invalidar queries silenciosamente
      queryClient.invalidateQueries({ queryKey: ['budget-detail', data.budget.id] });
      
      // Resetear estado después de 3 segundos
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error('Error en autoguardado:', error);
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus('idle'), 5000);
    }
  };

  // Autoguardado cada 30 segundos
  useEffect(() => {
    if (!isEditingEconomico || !hasUnsavedChanges) return;
    
    const autoSaveInterval = setInterval(() => {
      performAutoSave();
    }, 30000); // 30 segundos

    return () => clearInterval(autoSaveInterval);
  }, [isEditingEconomico, hasUnsavedChanges, economicItems, data?.budget?.id]);

  // Marcar cambios pendientes cuando se modifican los items
  const handleEconomicItemsChange = (newItems: any[]) => {
    setEconomicItems(newItems);
    setHasUnsavedChanges(true);
    setAutoSaveStatus('idle');
  };

  const duplicateMutation = useMutation({
    mutationFn: async (budget: any) => {
      const { data: newBudget, error: budgetError } = await supabase
        .from('budgets')
        .insert({
          title: `${budget.title} (Copia)`,
          client_id: budget.client_id,
          description: budget.description,
          valid_until: budget.valid_until,
          total_amount: budget.total_amount,
          status: 'pending',
          created_by: user?.id,
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
      toast.success('Presupuesto duplicado correctamente');
      navigate(`/presupuestos/${newBudget.id}`);
    },
    onError: (error: any) => {
      toast.error('Error al duplicar presupuesto: ' + error.message);
    },
  });

  // Función para cambio manual de estado
  const handleStatusChange = async (newStatus: string) => {
    if (!data?.budget) return;
    const previousStatus = data.budget.status;

    // Bloquear cambio de estado desde "approved" si hay datos asociados
    if (previousStatus === 'approved' && newStatus !== 'approved' && hasAssociatedDataForStatusChange) {
      const details: string[] = [];
      if (hasFinancialRequests) {
        details.push(`${existingRequests?.length} solicitud(es) financiera(s)`);
      }
      if (hasOperationalProjects) {
        details.push(`${existingProjects?.length} proyecto(s) operacional(es)`);
      }
      toast.error(
        `No se puede cambiar el estado de un presupuesto aprobado que tiene ${details.join(' y ')} asociados. Elimina primero los datos relacionados.`,
        { duration: 6000 }
      );
      return;
    }

    try {
      const { error } = await supabase
        .from('budgets')
        .update({ status: newStatus })
        .eq('id', data.budget.id);

      if (error) throw error;

      // Registrar en activity_log
      await supabase.from('activity_log').insert({
        entity_type: 'budget',
        entity_id: data.budget.id,
        action: 'status_change',
        changes: { previous: previousStatus, new: newStatus },
        user_id: user?.id,
      });

      queryClient.invalidateQueries({ queryKey: ['budget-detail', data.budget.id] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success(`Estado cambiado a: ${getBudgetStatusLabel(newStatus)}`);
    } catch (error: any) {
      toast.error('Error al cambiar estado: ' + error.message);
    }
  };

  // Función para aprobar presupuesto y generar solicitudes
  const handleApproveBudget = () => {
    if (!data?.budget) return;
    approveMutation.mutate({
      budgetId: data.budget.id,
      onSuccess: () => {
        setShowProjectModal(true);
      }
    });
  };

  // Función para guardar cambios de Resumen
  const handleSaveResumen = async () => {
    if (!data?.budget) return;
    setIsSavingResumen(true);

    const previousData = {
      title: data.budget.title,
      client_id: data.budget.client_id,
      description: data.budget.description,
      valid_until: data.budget.valid_until,
    };

    try {
      const { error } = await supabase
        .from('budgets')
        .update({
          title: resumenFormData.title,
          client_id: resumenFormData.client_id,
          description: resumenFormData.description || null,
          valid_until: resumenFormData.valid_until || null,
        })
        .eq('id', data.budget.id);

      if (error) throw error;

      // Registrar en activity_log
      await supabase.from('activity_log').insert({
        entity_type: 'budget',
        entity_id: data.budget.id,
        action: 'update_resumen',
        changes: { previous: previousData, new: resumenFormData },
        user_id: user?.id,
      });

      queryClient.invalidateQueries({ queryKey: ['budget-detail', data.budget.id] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Resumen actualizado correctamente');
      setIsEditingResumen(false);
    } catch (error: any) {
      toast.error('Error al actualizar: ' + error.message);
    } finally {
      setIsSavingResumen(false);
    }
  };

  // Función para guardar cambios de Detalle Económico
  const handleSaveEconomico = async () => {
    if (!data?.budget) return;
    
    if (economicItems.length === 0) {
      toast.error('Debes tener al menos una línea en el presupuesto');
      return;
    }

    if (economicItems.some((item) => !item.service_id)) {
      toast.error('Todas las líneas deben tener un servicio seleccionado');
      return;
    }

    setIsSavingEconomico(true);
    const previousItemsCount = data.items.length;
    const previousTotal = data.budget.total_amount;
    const newTotal = calculateBudgetTotal(economicItems);

    try {
      // Eliminar items antiguos
      await supabase.from('budget_items').delete().eq('budget_id', data.budget.id);

      // Insertar nuevos items con specialist_id
      const itemsToInsert = economicItems.map((item) => ({
        budget_id: data.budget.id,
        service_id: item.service_id,
        specialist_id: item.specialist_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from('budget_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Actualizar total_amount en budget
      const { error: budgetError } = await supabase
        .from('budgets')
        .update({ total_amount: newTotal })
        .eq('id', data.budget.id);

      if (budgetError) throw budgetError;

      // Registrar en activity_log
      await supabase.from('activity_log').insert({
        entity_type: 'budget',
        entity_id: data.budget.id,
        action: 'update_economico',
        changes: {
          previous_items_count: previousItemsCount,
          new_items_count: economicItems.length,
          previous_total: previousTotal,
          new_total: newTotal,
        },
        user_id: user?.id,
      });

      queryClient.invalidateQueries({ queryKey: ['budget-detail', data.budget.id] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Detalle económico actualizado correctamente');
      setHasUnsavedChanges(false);
      setAutoSaveStatus('idle');
      setIsEditingEconomico(false);
    } catch (error: any) {
      toast.error('Error al actualizar: ' + error.message);
    } finally {
      setIsSavingEconomico(false);
    }
  };

  const handleCancelResumen = () => {
    if (data?.budget) {
      setResumenFormData({
        title: data.budget.title || '',
        client_id: data.budget.client_id || '',
        description: data.budget.description || '',
        valid_until: data.budget.valid_until || '',
      });
    }
    setIsEditingResumen(false);
  };

  const handleCancelEconomico = () => {
    if (data?.items) {
      setEconomicItems(data.items);
    }
    setHasUnsavedChanges(false);
    setAutoSaveStatus('idle');
    setLastAutoSave(null);
    setIsEditingEconomico(false);
  };

  if (isLoading) {
    return (
      <AppLayout title="Cargando..." description="">
        <div className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout title="Error" description="No se pudo cargar el presupuesto">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Presupuesto no encontrado</p>
          <Button onClick={() => navigate('/presupuestos')} className="mt-4">
            Volver a Presupuestos
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { budget, items, requests, projects } = data;

  const itemsByCategory = items.reduce((acc: any, item: any) => {
    const category = item.service?.category || 'Sin categoría';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  const totalPresupuestado = budget.total_amount || 0;
  const totalConSolicitudes = requests.reduce((sum: number, req: any) => {
    return sum + (req.sale_amount || 0);
  }, 0);
  const totalFacturado = requests.reduce((sum: number, req: any) => {
    if (req.billed_invoice) {
      return sum + (req.sale_amount || 0);
    }
    return sum;
  }, 0);
  const pendienteFacturar = totalPresupuestado - totalFacturado;

  const handleEditDocUrl = () => {
    setDocUrlInput(budget.accepted_document_url || '');
    setIsEditingDocUrl(true);
  };

  const handleSaveDocUrl = async () => {
    try {
      const previousUrl = budget.accepted_document_url;
      const { error } = await supabase
        .from('budgets')
        .update({ accepted_document_url: docUrlInput || null })
        .eq('id', budget.id);

      if (error) throw error;

      // Registrar en activity_log
      await supabase.from('activity_log').insert({
        entity_type: 'budget',
        entity_id: budget.id,
        action: 'update_doc_url',
        changes: { previous: previousUrl, new: docUrlInput || null },
        user_id: user?.id,
      });

      queryClient.invalidateQueries({ queryKey: ['budget-detail', budget.id] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });

      toast.success('Enlace del documento aceptado actualizado correctamente');
      setIsEditingDocUrl(false);
    } catch (error: any) {
      toast.error('Error al actualizar el enlace: ' + error.message);
    }
  };

  const selectedClientName = clients?.find((c) => c.id === resumenFormData.client_id)?.name || budget.client?.name;

  return (
    <AppLayout 
      title={budget.code ? `${budget.code} - ${budget.title}` : budget.title} 
      description={`Presupuesto ${budget.client?.name || ''}`}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/presupuestos')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Presupuestos
          </Button>
          <div className="flex gap-2">
            {budget.status !== 'approved' && budget.status !== 'rejected' && (
              <Button 
                onClick={handleApproveBudget} 
                disabled={approveMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <CheckCircle className="h-4 w-4 mr-2" />
                Aprobar y Generar Solicitudes
              </Button>
            )}
            {budget.status === 'approved' && !hasFinancialRequests && (
              <Button 
                onClick={() => generateRequestsMutation.mutate()}
                disabled={generateRequestsMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {generateRequestsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <ListPlus className="h-4 w-4 mr-2" />
                Generar Solicitudes y Proyecto
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => duplicateMutation.mutate(budget)}
              disabled={duplicateMutation.isPending}
            >
              <Copy className="h-4 w-4 mr-2" />
              Usar como Plantilla
            </Button>
            <Button onClick={() => setEditModalOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar Completo
            </Button>
            <Button variant="destructive" onClick={handleDeleteClick}>
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="resumen" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="economico">Detalle Económico</TabsTrigger>
            <TabsTrigger value="operacion">Operación</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>Información General</CardTitle>
                {!isEditingResumen && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditingResumen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Resumen
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditingResumen ? (
                  // Modo edición
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Título</Label>
                        <Input
                          id="title"
                          value={resumenFormData.title}
                          onChange={(e) => setResumenFormData({ ...resumenFormData, title: e.target.value })}
                          placeholder="Título del presupuesto"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="client">Cliente</Label>
                        <Select
                          value={resumenFormData.client_id}
                          onValueChange={(value) => setResumenFormData({ ...resumenFormData, client_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients?.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="valid_until">Válido hasta</Label>
                        <Input
                          id="valid_until"
                          type="date"
                          value={resumenFormData.valid_until}
                          onChange={(e) => setResumenFormData({ ...resumenFormData, valid_until: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Estado</Label>
                        <Select value={budget.status} onValueChange={handleStatusChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendiente</SelectItem>
                            <SelectItem value="sent">Enviado</SelectItem>
                            <SelectItem value="approved">Aprobado</SelectItem>
                            <SelectItem value="rejected">Rechazado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Objetivo de campaña / Resumen</Label>
                      <Textarea
                        id="description"
                        value={resumenFormData.description}
                        onChange={(e) => setResumenFormData({ ...resumenFormData, description: e.target.value })}
                        rows={3}
                        placeholder="Describe brevemente el objetivo de la campaña..."
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button variant="outline" onClick={handleCancelResumen} disabled={isSavingResumen}>
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveResumen} disabled={isSavingResumen}>
                        {isSavingResumen && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Resumen
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Modo visualización
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-muted-foreground">Título</p>
                        <p className="text-lg font-semibold">{budget.title}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Cliente</p>
                        <p className="text-lg font-semibold">{budget.client?.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Estado</p>
                        <div className="flex items-center gap-3">
                          <Select value={budget.status} onValueChange={handleStatusChange}>
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="sent">Enviado</SelectItem>
                              <SelectItem value="approved">Aprobado</SelectItem>
                              <SelectItem value="rejected">Rechazado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Válido hasta</p>
                        <p className="text-lg">
                          {budget.valid_until
                            ? format(new Date(budget.valid_until), 'dd MMMM yyyy', { locale: es })
                            : 'No especificado'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Fecha de creación</p>
                        <p className="text-lg">
                          {format(new Date(budget.created_at), 'dd MMMM yyyy', { locale: es })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Monto Total</p>
                        <p className="text-2xl font-bold text-primary">
                          {formatCurrency(totalPresupuestado)}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t space-y-4">
                      {budget.description && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Objetivo de campaña / Resumen
                          </p>
                          <p className="text-base whitespace-pre-wrap">{budget.description}</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Documento aceptado por el cliente</p>
                        {budget.accepted_document_url ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="gap-2"
                            >
                              <a
                                href={budget.accepted_document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileText className="h-4 w-4" />
                                Ver documento
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleEditDocUrl}
                            >
                              Editar enlace
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <p className="text-sm text-muted-foreground">Sin documento aún</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleEditDocUrl}
                            >
                              Añadir enlace
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="economico" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="flex items-center gap-3">
                  <CardTitle>Líneas del Presupuesto</CardTitle>
                  {isEditingEconomico && (
                    <div className="flex items-center gap-2 text-sm">
                      {autoSaveStatus === 'saving' && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Guardando...
                        </span>
                      )}
                      {autoSaveStatus === 'saved' && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Cloud className="h-3 w-3" />
                          Guardado automáticamente
                        </span>
                      )}
                      {autoSaveStatus === 'error' && (
                        <span className="flex items-center gap-1 text-destructive">
                          <CloudOff className="h-3 w-3" />
                          Error al guardar
                        </span>
                      )}
                      {hasUnsavedChanges && autoSaveStatus === 'idle' && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          Cambios sin guardar
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {!isEditingEconomico && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditingEconomico(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Líneas
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {isEditingEconomico ? (
                  // Modo edición con BudgetItemsEditor
                  <div className="space-y-4">
                    <BudgetItemsEditor
                      items={economicItems}
                      onChange={handleEconomicItemsChange}
                      disabled={false}
                    />
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-xs text-muted-foreground">
                        {lastAutoSave && (
                          <span>
                            Último guardado: {format(lastAutoSave, 'HH:mm:ss', { locale: es })}
                          </span>
                        )}
                        {!lastAutoSave && hasUnsavedChanges && (
                          <span>Autoguardado cada 30 segundos</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={handleCancelEconomico} disabled={isSavingEconomico}>
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                        <Button onClick={handleSaveEconomico} disabled={isSavingEconomico}>
                          {isSavingEconomico && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          <Save className="h-4 w-4 mr-2" />
                          Guardar y Cerrar
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Modo visualización
                  Object.entries(itemsByCategory).map(([category, categoryItems]: [string, any]) => {
                    const subtotal = categoryItems.reduce((sum: number, item: any) => sum + item.total, 0);
                    return (
                      <div key={category} className="mb-6 last:mb-0">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-lg">{category}</h4>
                          <span className="text-sm font-medium text-muted-foreground">
                            Subtotal: {formatCurrency(subtotal)}
                          </span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Servicio</TableHead>
                              <TableHead>Descripción</TableHead>
                              <TableHead className="text-center">Cantidad</TableHead>
                              <TableHead className="text-right">Precio Unit.</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {categoryItems.map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                  {item.service?.name || 'Sin servicio'}
                                </TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell className="text-center">{item.quantity}</TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(item.unit_price)}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatCurrency(item.total)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas Económicas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Total Presupuestado</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalPresupuestado)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Con Solicitudes Creadas</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(totalConSolicitudes)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Total Facturado</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(totalFacturado)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Pendiente de Facturar</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(pendienteFacturar)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {requests.length > 0 ? 'Solicitudes Financieras Generadas' : 'Items del Presupuesto (Sin solicitudes generadas)'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {requests.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Servicio</TableHead>
                        <TableHead>Especialista</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request: any) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-mono text-sm">{request.code}</TableCell>
                          <TableCell>{request.title}</TableCell>
                          <TableCell>{request.service?.name}</TableCell>
                          <TableCell>{request.specialist?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={request.status === 'active' ? 'default' : 'secondary'}>
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(request.sale_amount || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Servicio</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead className="text-right">Precio Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.service?.name || 'Sin servicio'}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unit_price)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(item.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="operacion" className="space-y-6">
            {projects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No hay proyectos operativos vinculados a este presupuesto
                  </p>
                </CardContent>
              </Card>
            ) : (
              projects.map((project: any) => (
                <Card key={project.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{project.name}</CardTitle>
                      <Badge>{project.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mb-4">{project.description}</p>
                    )}
                    {project.operational_requests && project.operational_requests.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Solicitudes Operativas</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nombre</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Deadline</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {project.operational_requests.map((req: any) => (
                              <TableRow key={req.id}>
                                <TableCell>{req.name}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{req.status}</Badge>
                                </TableCell>
                                <TableCell>
                                  {req.deadline
                                    ? format(new Date(req.deadline), 'dd/MM/yyyy', { locale: es })
                                    : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isEditingDocUrl} onOpenChange={setIsEditingDocUrl}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {budget.accepted_document_url
                ? 'Editar enlace del documento aceptado'
                : 'Añadir enlace del documento aceptado'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pega el enlace al PDF o documento firmado que ha aceptado el cliente.
            </p>
            <div className="space-y-2">
              <Label htmlFor="acceptedDocUrl">URL del documento aceptado</Label>
              <Input
                id="acceptedDocUrl"
                type="url"
                placeholder="https://..."
                value={docUrlInput}
                onChange={(e) => setDocUrlInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsEditingDocUrl(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveDocUrl}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BudgetFormModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        budget={budget}
        mode="edit"
      />

      {/* Modal de confirmación post-aprobación */}
      <ProjectCreationModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        budget={{ ...budget, budget_items: items }}
        onCreateProject={() => {
          setShowProjectModal(false);
          // Crear proyecto con actividades automáticamente
          if (user?.id && budget.id && budget.client_id) {
            createProjectWithActivities.mutate({
              projectData: {
                name: budget.title,
                client_id: budget.client_id,
                budget_id: budget.id,
                description: budget.description || null,
                status: 'pending',
                created_by: user.id,
              }
            });
          }
        }}
      />

      {/* Modal de confirmación de eliminación */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setAssociatedData(null);
          }
        }}
        title="Eliminar Presupuesto"
        description={
          isLoadingAssociatedData
            ? 'Cargando información...'
            : associatedData && (associatedData.requests > 0 || associatedData.projects > 0)
            ? `¿Estás seguro de eliminar "${budget.title}"?\n\nSe eliminarán también:\n• ${associatedData.requests} solicitud(es) financiera(s)\n• ${associatedData.projects} proyecto(s) operacional(es)\n• ${associatedData.activities} actividad(es) del proyecto\n\nEsta acción no se puede deshacer.`
            : `¿Estás seguro de eliminar "${budget.title}"? Esta acción no se puede deshacer.`
        }
        confirmText={isDeleting ? 'Eliminando...' : 'Eliminar Todo'}
        cancelText="Cancelar"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </AppLayout>
  );
}
