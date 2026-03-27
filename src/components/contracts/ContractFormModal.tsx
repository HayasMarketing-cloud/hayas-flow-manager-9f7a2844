import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ContractServicesEditor } from './ContractServicesEditor';
import { ContractProjectCreationModal } from './ContractProjectCreationModal';
import { useCreateProjectFromContract } from '@/hooks/useCreateProjectFromContract';
import { Loader2, FileText, Play, Pause, RotateCw, AlertCircle, FolderKanban, ExternalLink } from 'lucide-react';
interface ContractFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract?: any;
  mode?: 'create' | 'edit' | 'view';
}

export const ContractFormModal = ({ isOpen, onClose, contract, mode = 'create' }: ContractFormModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showProjectModal, setShowProjectModal] = useState(false);
  const createProjectMutation = useCreateProjectFromContract();
  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'draft',
    contract_type: 'retainer' as 'retainer' | 'project' | 'one_time',
    enable_auto_requests: false,
    is_on_demand: false,
    am_user_id: '',
    pm_user_id: '',
    attached_contract_url: '',
  });
  const [services, setServices] = useState<any[]>([]);

  // Load profiles for AM/PM assignment
  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');
      if (error) throw error;
      return data;
    },
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

  useEffect(() => {
    if (contract) {
      setFormData({
        title: contract.title || '',
        client_id: contract.client_id || '',
        description: contract.description || '',
        start_date: contract.start_date || '',
        end_date: contract.end_date || '',
        status: contract.status || 'draft',
        contract_type: contract.contract_type || 'retainer',
        enable_auto_requests: contract.enable_auto_requests || false,
        is_on_demand: contract.is_on_demand || false,
        am_user_id: contract.am_user_id || '',
        pm_user_id: contract.pm_user_id || '',
        attached_contract_url: contract.attached_contract_url || '',
      });
    } else {
      setFormData({
        title: '',
        client_id: '',
        description: '',
        start_date: '',
        end_date: '',
        status: 'draft',
        contract_type: 'retainer',
        enable_auto_requests: false,
        is_on_demand: false,
        am_user_id: '',
        pm_user_id: '',
        attached_contract_url: '',
      });
      setServices([]);
    }
  }, [contract, isOpen]);

  // Cargar servicios si está en modo edición/visualización
  const { data: contractServices } = useQuery({
    queryKey: ['contract-services', contract?.id],
    queryFn: async () => {
      if (!contract?.id) return [];
      
      const { data, error } = await supabase
        .from('contract_services')
        .select('*')
        .eq('contract_id', contract.id)
        .order('created_at');
      
      if (error) throw error;
      return data;
    },
    enabled: !!contract?.id && isOpen,
  });

  // Cargar datos relacionados para mostrar aviso
  const { data: relatedData } = useQuery({
    queryKey: ['contract-related-data', contract?.id],
    queryFn: async () => {
      if (!contract?.id) return { budgets: 0, requests: 0 };
      
      const [budgetsResult, requestsResult] = await Promise.all([
        supabase.from('budgets').select('id', { count: 'exact', head: true }).eq('contract_id', contract.id),
        supabase.from('financial_requests').select('id', { count: 'exact', head: true }).eq('contract_id', contract.id)
      ]);
      
      return {
        budgets: budgetsResult.count || 0,
        requests: requestsResult.count || 0,
      };
    },
    enabled: !!contract?.id && isOpen,
  });

  // Query para verificar si ya existe un proyecto operativo para este contrato
  const { data: existingProject } = useQuery({
    queryKey: ['contract-operational-project', contract?.id],
    queryFn: async () => {
      if (!contract?.id) return null;
      
      const { data, error } = await supabase
        .from('operational_projects')
        .select('id, name')
        .eq('contract_id', contract.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!contract?.id && isOpen,
  });

  // Query para contar financial_requests del contrato (para crear milestones)
  const { data: contractRequestsCount } = useQuery({
    queryKey: ['contract-financial-requests-count', contract?.id],
    queryFn: async () => {
      if (!contract?.id) return 0;
      
      const { count, error } = await supabase
        .from('financial_requests')
        .select('id', { count: 'exact', head: true })
        .eq('contract_id', contract.id);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!contract?.id && isOpen,
  });

  useEffect(() => {
    if (contractServices) {
      setServices(contractServices);
    }
  }, [contractServices]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Calculate total only from fixed services
      const fixedServicesTotal = services
        .filter((s) => (s.price_rule_type || 'fixed') === 'fixed')
        .reduce((sum, s) => sum + (s.quantity * (s.price_value || s.unit_price || 0)), 0);

      // Convert empty dates to null to avoid database errors
      const contractData = {
        title: formData.title,
        client_id: formData.client_id,
        description: formData.description || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        status: formData.status,
        contract_type: formData.contract_type,
        total_amount: fixedServicesTotal,
        enable_auto_requests: formData.enable_auto_requests,
        is_on_demand: formData.is_on_demand,
        am_user_id: formData.am_user_id || null,
        pm_user_id: formData.pm_user_id || null,
      };

      if (contract?.id) {
        // Actualizar contrato
        const { error: contractError } = await supabase
          .from('contracts')
          .update(contractData)
          .eq('id', contract.id);

        if (contractError) throw contractError;

        // Eliminar servicios antiguos y crear nuevos
        await supabase.from('contract_services').delete().eq('contract_id', contract.id);

        if (services.length > 0) {
          const servicesToInsert = services.map((service) => ({
            contract_id: contract.id,
            service_id: service.service_id,
            specialist_id: service.specialist_id,
            description: service.description,
            quantity: service.price_rule_type === 'hourly' ? 1 : service.quantity,
            price_value: service.price_value || service.unit_price || 0,
            price_rule_type: service.price_rule_type || 'fixed',
            billing_frequency: service.billing_frequency || 'monthly',
            notes: service.notes,
          }));

          const { error: servicesError } = await supabase
            .from('contract_services')
            .insert(servicesToInsert);

          if (servicesError) throw servicesError;
        }
      } else {
        // Crear nuevo contrato
        const { data: newContract, error: contractError } = await supabase
          .from('contracts')
          .insert({
            ...contractData,
            created_by: user?.id,
          })
          .select()
          .single();

        if (contractError) throw contractError;

        if (services.length > 0) {
          const servicesToInsert = services.map((service) => ({
            contract_id: newContract.id,
            service_id: service.service_id,
            specialist_id: service.specialist_id,
            description: service.description,
            quantity: service.price_rule_type === 'hourly' ? 1 : service.quantity,
            price_value: service.price_value || service.unit_price || 0,
            price_rule_type: service.price_rule_type || 'fixed',
            billing_frequency: service.billing_frequency || 'monthly',
            notes: service.notes,
          }));

          const { error: servicesError } = await supabase
            .from('contract_services')
            .insert(servicesToInsert);

          if (servicesError) throw servicesError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success(contract ? 'Contrato actualizado' : 'Contrato creado correctamente');
      onClose();
    },
    onError: (error: any) => {
      toast.error('Error al guardar el contrato: ' + error.message);
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!contract?.id) return;

      const { error } = await supabase
        .from('contracts')
        .update({ status: newStatus })
        .eq('id', contract.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Estado actualizado correctamente');
      onClose();
    },
    onError: (error: any) => {
      toast.error('Error al cambiar el estado: ' + error.message);
    },
  });

  const generateRequestsMutation = useMutation({
    mutationFn: async () => {
      if (!contract?.id) return;

      // Get the current user's session token for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No hay sesión activa');
      }

      // Call edge function with user's JWT for proper authorization
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-monthly-requests`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ contract_id: contract.id }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al generar requests');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['financial-requests'] });
      toast.success(`${data.count} solicitudes generadas correctamente`);
      onClose();
    },
    onError: (error: any) => {
      toast.error('Error al generar requests: ' + error.message);
    },
  });

  const handleSave = () => {
    if (!formData.title || !formData.client_id) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    if (services.length === 0) {
      toast.error('Debes añadir al menos un servicio al contrato');
      return;
    }

    saveMutation.mutate();
  };

  const handleActivate = () => {
    changeStatusMutation.mutate('active');
  };

  const handleSuspend = () => {
    changeStatusMutation.mutate('suspended');
  };

  const handleResume = () => {
    changeStatusMutation.mutate('active');
  };

  const handleGenerateRequests = () => {
    generateRequestsMutation.mutate();
  };

  const handleCreateProject = () => {
    if (!contract || !user) return;
    
    createProjectMutation.mutate(
      {
        projectData: {
          name: contract.title,
          client_id: contract.client_id,
          contract_id: contract.id,
          description: contract.description,
          owner_user_id: contract.pm_user_id || contract.am_user_id || user.id,
          created_by: user.id,
          hub_project_url: contract.hub_project_url,
        },
      },
      {
        onSuccess: (data) => {
          setShowProjectModal(false);
          navigate(`/proyectos-operativos/${data.project.id}`);
        },
      }
    );
  };

  const isViewMode = mode === 'view';
  const canEdit = !isViewMode;
  const hasRelatedData = (relatedData?.budgets || 0) > 0 || (relatedData?.requests || 0) > 0;
  const canCreateProject = isViewMode && contract?.status === 'active' && !existingProject && (contractRequestsCount || 0) > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {contract?.code && (
              <Badge variant="outline" className="font-mono">
                {contract.code}
              </Badge>
            )}
            {isViewMode ? 'Ver Contrato' : contract ? 'Editar Contrato' : 'Nuevo Contrato'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'edit' && hasRelatedData && (
          <Alert variant="default" className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Contrato con datos vinculados</AlertTitle>
            <AlertDescription className="text-amber-700">
              Este contrato tiene {relatedData?.requests ? `${relatedData.requests} solicitudes` : ''}
              {relatedData?.requests && relatedData?.budgets ? ' y ' : ''}
              {relatedData?.budgets ? `${relatedData.budgets} presupuestos` : ''} vinculados.
              Los cambios en el cliente no afectarán a los registros existentes.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={!canEdit}
                placeholder="Ej: Contrato Servicios Mensual"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">
                Cliente <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                disabled={!canEdit}
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
              <Label htmlFor="start_date">Fecha de Inicio</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">Fecha de Fin</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                disabled={!canEdit}
              />
            </div>

            {/* Account Manager */}
            <div className="space-y-2">
              <Label>Account Manager</Label>
              <Select
                value={formData.am_user_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, am_user_id: value === 'none' ? '' : value })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {profiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name || profile.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Manager */}
            <div className="space-y-2">
              <Label>Project Manager</Label>
              <Select
                value={formData.pm_user_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, pm_user_id: value === 'none' ? '' : value })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {profiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name || profile.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="suspended">Suspendido</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Contrato */}
            <div className="space-y-2">
              <Label>Tipo de Contrato</Label>
              <Select
                value={formData.contract_type === 'one_time' ? 'project' : formData.contract_type}
                onValueChange={(value: 'retainer' | 'project') => setFormData({ ...formData, contract_type: value })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retainer">Recurrente</SelectItem>
                  <SelectItem value="project">Puntual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={!canEdit}
              rows={3}
              placeholder="Describe el contrato..."
            />
        </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="enable_auto_requests">Requests Recurrentes</Label>
                <p className="text-sm text-muted-foreground">
                  Generación automática mensual
                </p>
              </div>
              <Switch
                id="enable_auto_requests"
                checked={formData.enable_auto_requests}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enable_auto_requests: checked })
                }
                disabled={!canEdit}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="is_on_demand">Según Demanda</Label>
                <p className="text-sm text-muted-foreground">
                  Servicios sin cantidad prefijada
                </p>
              </div>
              <Switch
                id="is_on_demand"
                checked={formData.is_on_demand}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_on_demand: checked })
                }
                disabled={!canEdit}
              />
            </div>
          </div>

          <ContractServicesEditor services={services} onChange={setServices} disabled={!canEdit} />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>

          {canEdit && (
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <FileText className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          )}

          {isViewMode && contract?.status === 'draft' && (
            <Button onClick={handleActivate} disabled={changeStatusMutation.isPending}>
              <Play className="h-4 w-4 mr-2" />
              Activar
            </Button>
          )}

          {isViewMode && contract?.status === 'active' && (
            <>
              <Button
                variant="outline"
                onClick={handleSuspend}
                disabled={changeStatusMutation.isPending}
              >
                <Pause className="h-4 w-4 mr-2" />
                Suspender
              </Button>
              {contract?.enable_auto_requests && (
                <Button onClick={handleGenerateRequests} disabled={generateRequestsMutation.isPending}>
                  {generateRequestsMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <RotateCw className="h-4 w-4 mr-2" />
                  Generar Requests
                </Button>
              )}
              {canCreateProject && (
                <Button variant="default" onClick={() => setShowProjectModal(true)}>
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Crear Proyecto
                </Button>
              )}
              {existingProject && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/proyectos-operativos/${existingProject.id}`)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Proyecto
                </Button>
              )}
            </>
          )}

          {isViewMode && contract?.status === 'suspended' && (
            <Button onClick={handleResume} disabled={changeStatusMutation.isPending}>
              <Play className="h-4 w-4 mr-2" />
              Reanudar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {contract && (
        <ContractProjectCreationModal
          isOpen={showProjectModal}
          onClose={() => setShowProjectModal(false)}
          contract={{
            id: contract.id,
            title: contract.title,
            code: contract.code,
            client: contract.client,
          }}
          requestsCount={contractRequestsCount || 0}
          onCreateProject={handleCreateProject}
          isCreating={createProjectMutation.isPending}
        />
      )}
    </Dialog>
  );
};
