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
import { ArrowLeft, Edit, Copy, FileText, Save, X, Loader2, CheckCircle, Trash2, CloudOff, Cloud, FileDown, Users, FileSignature, ExternalLink, FolderKanban, ListChecks, PiggyBank, Link2, Check } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateBudgetPDF } from '@/utils/pdf/budgetPDFGenerator';
import { useBudgetDetail } from '@/hooks/useBudgetDetail';
import { BudgetStatusBadge } from '@/components/budgets/BudgetStatusBadge';
import { BudgetItemsEditor } from '@/components/budgets/BudgetItemsEditor';
import { formatCurrency, getBudgetStatusLabel, calculateBudgetTotal, toManualBudgetStatus } from '@/lib/budget-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import React, { useState, useEffect } from 'react';
import { BudgetFormModal } from '@/components/budgets/BudgetFormModal';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useApproveBudget } from '@/hooks/useApproveBudget';
import { useCreateProjectWithActivities } from '@/hooks/useCreateProjectWithActivities';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { BudgetContextTab } from '@/components/budgets/BudgetContextTab';
import { useBudgetPnL } from '@/hooks/useEntityPnL';
import { FinancialControllingCard } from '@/components/shared/FinancialControllingCard';
import { BudgetLinkedInvoicesCard } from '@/components/budgets/BudgetLinkedInvoicesCard';
import { BudgetInvoicingSummary } from '@/components/budgets/BudgetInvoicingSummary';
import { GenerateRequestsConfirmModal } from '@/components/budgets/GenerateRequestsConfirmModal';
import { useGenerateBudgetRequests } from '@/hooks/useGenerateBudgetRequests';


export default function PresupuestoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useBudgetDetail(id);
  const { data: pnl, isLoading: loadingPnL } = useBudgetPnL(id || '');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isEditingDocUrl, setIsEditingDocUrl] = useState(false);
  const [docUrlInput, setDocUrlInput] = useState('');
  
  // Estados para flujo de aprobación
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [generationModalOpen, setGenerationModalOpen] = useState(false);
  const [generationMode, setGenerationMode] = useState<'generate' | 'approve'>('generate');

  
  // Estados para eliminación
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [associatedData, setAssociatedData] = useState<{
    requests: number;
    projects: number;
    activities: number;
  } | null>(null);
  const [isLoadingAssociatedData, setIsLoadingAssociatedData] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingRequests, setIsGeneratingRequests] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Hooks de aprobación y creación de proyecto con actividades
  const approveMutation = useApproveBudget();
  const generateRequestsMutation = useGenerateBudgetRequests();

  const createProjectWithActivities = useCreateProjectWithActivities();

  // Query para obtener token de compartición existente
  const { data: existingShareToken } = useQuery({
    queryKey: ['budget-share-token', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_share_tokens')
        .select('token, short_code')
        .eq('budget_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // Función para generar o copiar enlace compartible
  const handleShareLink = async () => {
    if (!data?.budget || !user) return;
    
    try {
      setIsGeneratingLink(true);
      let shortCode = existingShareToken?.short_code;

      if (!shortCode) {
        const { data: newToken, error } = await supabase
          .from('budget_share_tokens')
          .insert({
            budget_id: data.budget.id,
            created_by: user.id,
          })
          .select('short_code')
          .single();
        
        if (error) throw error;
        shortCode = newToken.short_code;
        queryClient.invalidateQueries({ queryKey: ['budget-share-token', id] });
      }

      const shareUrl = `${window.location.origin}/quote/${shortCode}`;
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      toast.success('Enlace copiado al portapapeles');
      setTimeout(() => setLinkCopied(false), 3000);
    } catch (error: any) {
      toast.error('Error al generar enlace: ' + error.message);
    } finally {
      setIsGeneratingLink(false);
    }
  };

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
    if (previousStatus === 'approved' && newStatus !== 'approved' && newStatus !== 'invoiced' && hasAssociatedDataForStatusChange) {
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
        setShowApprovalModal(true);
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
      // Obtener IDs de items existentes para mantener vinculación
      const existingItemIds = data.items.map((item: any) => item.id);
      
      // Separar items existentes (para actualizar) y nuevos (para insertar)
      const itemsToUpdate = economicItems.filter((item) => item.id && existingItemIds.includes(item.id));
      const itemsToInsert = economicItems.filter((item) => !item.id || !existingItemIds.includes(item.id));
      const itemIdsToKeep = itemsToUpdate.map((item) => item.id);
      
      // Eliminar items que ya no existen
      const itemsToDelete = existingItemIds.filter((id: string) => !itemIdsToKeep.includes(id));
      if (itemsToDelete.length > 0) {
        // Desvincular solicitudes de items eliminados
        await supabase
          .from('financial_requests')
          .update({ budget_item_id: null })
          .in('budget_item_id', itemsToDelete);
          
        await supabase
          .from('budget_items')
          .delete()
          .in('id', itemsToDelete);
      }

      // Actualizar items existentes
      for (const item of itemsToUpdate) {
        await supabase
          .from('budget_items')
          .update({
            service_id: item.service_id,
            specialist_id: item.specialist_id || null,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
            notes: item.notes || null,
          })
          .eq('id', item.id);
      }

      // Insertar nuevos items
      if (itemsToInsert.length > 0) {
        const newItems = itemsToInsert.map((item) => ({
          budget_id: data.budget.id,
          service_id: item.service_id,
          specialist_id: item.specialist_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          notes: item.notes || null,
        }));

        await supabase.from('budget_items').insert(newItems);
      }

      // Actualizar total_amount en budget
      const { error: budgetError } = await supabase
        .from('budgets')
        .update({ total_amount: newTotal })
        .eq('id', data.budget.id);

      if (budgetError) throw budgetError;

      // Sincronizar solicitudes financieras vinculadas
      const { data: linkedRequests } = await supabase
        .from('financial_requests')
        .select('id, budget_item_id')
        .eq('budget_id', data.budget.id)
        .not('budget_item_id', 'is', null);

      if (linkedRequests && linkedRequests.length > 0) {
        let syncCount = 0;
        for (const request of linkedRequests) {
          const budgetItem = itemsToUpdate.find((item) => item.id === request.budget_item_id);
          if (budgetItem) {
            await supabase
              .from('financial_requests')
              .update({
                title: budgetItem.description,
                service_id: budgetItem.service_id,
                specialist_id: budgetItem.specialist_id || null,
                quantity: budgetItem.quantity,
                unit_price: budgetItem.unit_price,
                sale_amount: budgetItem.total,
              })
              .eq('id', request.id);
            syncCount++;
          }
        }
        if (syncCount > 0) {
          queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
        }
      }

      // Sincronizar operational_requests vinculadas a las financial_requests
      if (linkedRequests && linkedRequests.length > 0) {
        const { data: linkedOpRequests } = await supabase
          .from('operational_requests')
          .select('id, financial_request_id')
          .in('financial_request_id', linkedRequests.map(r => r.id));

        if (linkedOpRequests && linkedOpRequests.length > 0) {
          let opSyncCount = 0;
          for (const opReq of linkedOpRequests) {
            const financialReq = linkedRequests.find(r => r.id === opReq.financial_request_id);
            const budgetItem = financialReq ? itemsToUpdate.find((item) => item.id === financialReq.budget_item_id) : null;
            if (budgetItem) {
              await supabase
                .from('operational_requests')
                .update({
                  name: budgetItem.description,
                })
                .eq('id', opReq.id);
              opSyncCount++;
            }
          }
          if (opSyncCount > 0) {
            queryClient.invalidateQueries({ queryKey: ['operational-projects'] });
          }
        }
      }

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

  // Extraer especialistas únicos del presupuesto (items + requests) - MUST be before early returns
  const teamSpecialists = React.useMemo(() => {
    const specialistMap = new Map();
    // From budget items
    data?.items?.forEach((item: any) => {
      if (item.specialist && !specialistMap.has(item.specialist.id)) {
        specialistMap.set(item.specialist.id, item.specialist);
      }
    });
    // From financial requests
    data?.requests?.forEach((req: any) => {
      if (req.specialist && req.specialist_id && !specialistMap.has(req.specialist_id)) {
        specialistMap.set(req.specialist_id, { id: req.specialist_id, name: req.specialist.name, type: 'Especialista' });
      }
    });
    return Array.from(specialistMap.values());
  }, [data?.items, data?.requests]);

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

  const { budget, items, requests, projects, creatorProfile, amProfile, pmProfile } = data;

  const itemsByCategory = items.reduce((acc: any, item: any) => {
    const category = item.service?.category || 'Sin categoría';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  const totalPresupuestado = budget.total_amount || 0;

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

  // Crear proyecto operativo
  const handleCreateProject = () => {
    setShowApprovalModal(false);
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
  };

  // Generar requests desde budget items (sin cambiar estado)
  // Derive which budget items still need request generation
  const generatedItemIds = new Set(
    data?.requests?.filter((r: any) => r.budget_item_id).map((r: any) => r.budget_item_id) || []
  );
  const ungeneratedItems = (data?.items || []).filter((i: any) => !generatedItemIds.has(i.id));

  const handleGenerateRequests = () => {
    if (ungeneratedItems.length === 0) {
      toast.error('No hay líneas pendientes para generar requests');
      return;
    }
    setGenerationMode('generate');
    setGenerationModalOpen(true);
  };

  const handleConfirmGeneration = async ({ budget: planBudget, lines }: { budget: any; lines: any[] }) => {
    try {
      if (lines.length > 0) {
        await generateRequestsMutation.mutateAsync({ budget: planBudget, lines });
      }
      if (generationMode === 'approve') {
        approveMutation.mutate({
          budgetId: planBudget.id,
          onSuccess: () => setShowApprovalModal(true),
        });
      }
      setGenerationModalOpen(false);
    } catch (e) {
      // errores ya notificados por la mutación
    }
  };


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
            <Button
              variant="outline"
              onClick={() => duplicateMutation.mutate(budget)}
              disabled={duplicateMutation.isPending}
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicar
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="controlling" className="flex items-center gap-1">
              <PiggyBank className="h-4 w-4" />
              Controlling
            </TabsTrigger>
            <TabsTrigger value="contexto">Contexto</TabsTrigger>
            <TabsTrigger value="economico">Detalle Económico</TabsTrigger>
          </TabsList>

          <TabsContent value="controlling" className="space-y-6">
            <FinancialControllingCard 
              data={pnl}
              isLoading={loadingPnL}
              title="Controlling Financiero del Presupuesto"
            />
            {(budget.status === 'approved' || budget.status === 'invoiced') && (
              <BudgetLinkedInvoicesCard
                budgetId={budget.id}
                budgetTotal={budget.total_amount || 0}
                estimatedInvoiceDate={budget.estimated_invoice_date}
              />
            )}
          </TabsContent>

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
                        <Select value={toManualBudgetStatus(budget.status)} onValueChange={handleStatusChange}>
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
                      {budget.contract && (
                        <div>
                          <p className="text-sm text-muted-foreground">Contrato Asociado</p>
                          <div className="flex items-center gap-2">
                            <FileSignature className="h-4 w-4 text-muted-foreground" />
                            <Button
                              variant="link"
                              className="p-0 h-auto text-lg font-semibold"
                              onClick={() => navigate(`/contratos`)}
                            >
                              {budget.contract.code} - {budget.contract.title}
                            </Button>
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Estado</p>
                        <div className="flex items-center gap-3">
                          <Select value={toManualBudgetStatus(budget.status)} onValueChange={handleStatusChange}>
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
                          <span className="text-xs text-muted-foreground">
                            El estado facturado se calcula automáticamente desde las facturas asociadas.
                          </span>
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

            {/* Sección Elementos Vinculados - NUEVA */}
            {(budget.status === 'approved' || requests.length > 0 || projects.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    Elementos Vinculados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Requests Proyecto */}
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                          <ListChecks className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium">Requests Proyecto</p>
                          <p className="text-sm text-muted-foreground">
                            {requests.length} {requests.length === 1 ? 'request vinculada' : 'requests vinculadas'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {requests.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/solicitudes?budget_id=${budget.id}`)}
                          >
                            Ver Requests
                            <ExternalLink className="h-4 w-4 ml-2" />
                          </Button>
                        )}
                        {budget.status === 'approved' && ungeneratedItems.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateRequests}
                            disabled={isGeneratingRequests}
                          >
                            {isGeneratingRequests ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <ListChecks className="h-4 w-4 mr-2" />
                            )}
                            Generar Requests
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Proyecto Operativo */}
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                          <FolderKanban className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="font-medium">Proyecto Operativo</p>
                          <p className="text-sm text-muted-foreground">
                            {projects.length > 0 
                              ? `${projects.length} ${projects.length === 1 ? 'proyecto vinculado' : 'proyectos vinculados'}`
                              : 'Sin proyecto creado'}
                          </p>
                        </div>
                      </div>
                      {projects.length > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/operaciones/proyectos/${projects[0].id}`)}
                        >
                          Ver Proyecto
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </Button>
                      ) : requests.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Genera primero las requests
                        </p>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCreateProject}
                          disabled={createProjectWithActivities.isPending}
                        >
                          {createProjectWithActivities.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <FolderKanban className="h-4 w-4 mr-2" />
                          )}
                          Crear Proyecto
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sección Equipo de Trabajo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Equipo de Trabajo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Account Manager */}
                  {amProfile && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Account Manager
                      </p>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {amProfile.full_name?.charAt(0) || amProfile.email?.charAt(0) || 'A'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{amProfile.full_name || 'Sin nombre'}</p>
                          <p className="text-sm text-muted-foreground">{amProfile.email}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Project Manager */}
                  {pmProfile && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Project Manager
                      </p>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {pmProfile.full_name?.charAt(0) || pmProfile.email?.charAt(0) || 'P'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{pmProfile.full_name || 'Sin nombre'}</p>
                          <p className="text-sm text-muted-foreground">{pmProfile.email}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contacto del cliente */}
                  {budget.client_contact && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Contacto del Cliente
                      </p>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {(budget.client_contact as any).name?.charAt(0) || 'C'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{(budget.client_contact as any).name}</p>
                          <p className="text-sm text-muted-foreground">{(budget.client_contact as any).email}</p>
                          {(budget.client_contact as any).role && (
                            <Badge variant="outline" className="text-xs mt-1">{(budget.client_contact as any).role}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Especialistas */}
                  {teamSpecialists.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Especialistas ({teamSpecialists.length})
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {teamSpecialists.map((specialist: any) => (
                          <div
                            key={specialist.id}
                            className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {specialist.name?.charAt(0) || 'E'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{specialist.name}</p>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {specialist.type || 'Especialista'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Si no hay nadie asignado */}
                  {!amProfile && !pmProfile && !budget.client_contact && teamSpecialists.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No hay miembros del equipo asignados a este presupuesto.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contexto" className="space-y-6">
            <BudgetContextTab
              budgetId={budget.id}
              proposalContext={budget.proposal_context as any}
              userId={user?.id}
            />
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
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleShareLink}
                    disabled={isGeneratingLink}
                  >
                    {isGeneratingLink ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : linkCopied ? (
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    {linkCopied ? 'Enlace copiado' : 'Copiar enlace'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => generateBudgetPDF({ 
                      budget: { 
                        ...budget, 
                        requested_by: data?.budget?.client_contact?.name || null,
                        quote_code: existingShareToken?.short_code || null,
                      }, 
                      items 
                    })}
                    disabled={!items || items.length === 0}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Descargar PDF
                  </Button>
                  {!isEditingEconomico && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditingEconomico(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar Líneas
                    </Button>
                  )}
                </div>
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
                              <TableHead>Especialista</TableHead>
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
                                <TableCell>
                                  {item.specialist?.name || '-'}
                                </TableCell>
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
                <CardTitle>Resumen Económico</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Presupuestado</p>
                    <p className="text-3xl font-bold text-primary">{formatCurrency(totalPresupuestado)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Líneas</p>
                    <p className="text-2xl font-semibold">{items.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compact invoicing status — full breakdown lives in the Controlling tab */}
            {(budget.status === 'approved' || budget.status === 'invoiced') && (
              <BudgetInvoicingSummary
                budgetId={budget.id}
                budgetTotal={budget.total_amount || 0}
              />
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

      {/* Modal de confirmación post-aprobación simplificado */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <DialogTitle>Presupuesto Aprobado</DialogTitle>
            </div>
            <DialogDescription>
              El presupuesto <strong>{budget.title}</strong> ha sido aprobado exitosamente.
              Se han generado las solicitudes financieras automáticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cliente:</span>
                <span className="font-medium">{budget.client?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monto Total:</span>
                <span className="font-medium">{formatCurrency(budget.total_amount || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Solicitudes creadas:</span>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-start gap-3">
                <FolderKanban className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1 space-y-1">
                  <h4 className="text-sm font-medium">¿Deseas crear un proyecto operativo?</h4>
                  <p className="text-sm text-muted-foreground">
                    Puedes crear un proyecto operativo para organizar los milestones y tareas
                    asociados a este presupuesto.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => navigate(`/solicitudes?budget_id=${budget.id}`)}
              className="flex-1"
            >
              <ListChecks className="h-4 w-4 mr-2" />
              Ver Solicitudes
            </Button>
            <Button 
              onClick={handleCreateProject}
              disabled={createProjectWithActivities.isPending}
              className="flex-1"
            >
              {createProjectWithActivities.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FolderKanban className="h-4 w-4 mr-2" />
              )}
              Crear Proyecto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
