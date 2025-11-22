import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ContractServicesEditor } from './ContractServicesEditor';
import { calculateContractTotal } from '@/lib/contract-utils';
import { Loader2, FileText, Play, Pause, RotateCw } from 'lucide-react';

interface ContractFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract?: any;
  mode?: 'create' | 'edit' | 'view';
}

export const ContractFormModal = ({ isOpen, onClose, contract, mode = 'create' }: ContractFormModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'draft',
  });
  const [services, setServices] = useState<any[]>([]);

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
      });
    } else {
      setFormData({
        title: '',
        client_id: '',
        description: '',
        start_date: '',
        end_date: '',
        status: 'draft',
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

  useEffect(() => {
    if (contractServices) {
      setServices(contractServices);
    }
  }, [contractServices]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const totalAmount = calculateContractTotal(services);

      if (contract?.id) {
        // Actualizar contrato
        const { error: contractError } = await supabase
          .from('contracts')
          .update({
            ...formData,
            total_amount: totalAmount,
          })
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
            quantity: service.quantity,
            unit_price: service.unit_price,
            billing_mode: service.billing_mode,
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
            ...formData,
            total_amount: totalAmount,
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
            quantity: service.quantity,
            unit_price: service.unit_price,
            billing_mode: service.billing_mode,
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

      // Llamar al edge function para generar requests
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-monthly-requests`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
      queryClient.invalidateQueries({ queryKey: ['requests'] });
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

  const isViewMode = mode === 'view';
  const canEdit = !isViewMode && formData.status === 'draft';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isViewMode ? 'Ver Contrato' : contract ? 'Editar Contrato' : 'Nuevo Contrato'}
          </DialogTitle>
        </DialogHeader>

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
              <Button onClick={handleGenerateRequests} disabled={generateRequestsMutation.isPending}>
                {generateRequestsMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <RotateCw className="h-4 w-4 mr-2" />
                Generar Requests
              </Button>
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
    </Dialog>
  );
};
