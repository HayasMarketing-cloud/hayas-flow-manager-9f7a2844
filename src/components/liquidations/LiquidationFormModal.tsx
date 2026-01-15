import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect, useState, useMemo } from 'react';
import { formatPeriod } from '@/lib/liquidation-utils';
import { Database } from '@/integrations/supabase/types';
import { generateLiquidationPDF } from '@/utils/pdf/liquidationPDFGenerator';
import { FileDown, Plus, Trash2, Shield, CheckCircle2, XCircle, Clock, Globe, Monitor } from 'lucide-react';
import { useUnliquidatedRequests } from '@/hooks/useUnliquidatedRequests';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

type LiquidationStatus = Database['public']['Enums']['liquidation_status'];

const liquidationSchema = z.object({
  specialist_id: z.string().min(1, 'Especialista es requerido'),
  period_year: z.number().min(2020).max(2100),
  period_month: z.number().min(1).max(12),
  status: z.enum(['draft', 'validated', 'sent', 'accepted', 'pending_payment', 'paid']),
  notes: z.string().optional(),
});

type LiquidationFormData = z.infer<typeof liquidationSchema>;

interface LiquidationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  liquidation?: any;
  mode: 'create' | 'edit' | 'view';
}

interface ManualItem {
  id: string;
  description: string;
  amount: number;
}

// Component to display digital signature details
const SignatureDetailsSection = ({ signature }: { signature: any }) => {
  const isExpired = new Date(signature.expires_at) < new Date();
  const isPending = signature.status === 'pending';
  const isAccepted = signature.status === 'accepted';
  const isDisputed = signature.status === 'disputed';

  const getStatusConfig = () => {
    if (isAccepted) {
      return {
        icon: CheckCircle2,
        title: 'Liquidación Aceptada',
        bgColor: 'bg-green-50 border-green-200',
        iconColor: 'text-green-600',
        badgeVariant: 'default' as const,
        badgeClass: 'bg-green-100 text-green-700',
      };
    }
    if (isDisputed) {
      return {
        icon: XCircle,
        title: 'Liquidación Disputada',
        bgColor: 'bg-red-50 border-red-200',
        iconColor: 'text-red-600',
        badgeVariant: 'destructive' as const,
        badgeClass: 'bg-red-100 text-red-700',
      };
    }
    if (isPending && isExpired) {
      return {
        icon: Clock,
        title: 'Enlace de Firma Expirado',
        bgColor: 'bg-orange-50 border-orange-200',
        iconColor: 'text-orange-600',
        badgeVariant: 'secondary' as const,
        badgeClass: 'bg-orange-100 text-orange-700',
      };
    }
    return {
      icon: Clock,
      title: 'Pendiente de Firma',
      bgColor: 'bg-yellow-50 border-yellow-200',
      iconColor: 'text-yellow-600',
      badgeVariant: 'secondary' as const,
      badgeClass: 'bg-yellow-100 text-yellow-700',
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={`border rounded-lg p-4 space-y-4 ${config.bgColor}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full bg-background ${config.iconColor}`}>
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h4 className="font-semibold flex items-center gap-2">
            Firma Digital
            <Badge className={config.badgeClass}>
              <Icon className="h-3 w-3 mr-1" />
              {isAccepted ? 'Firmada' : isDisputed ? 'Disputada' : isPending && isExpired ? 'Expirada' : 'Pendiente'}
            </Badge>
          </h4>
          <p className="text-sm text-muted-foreground">{config.title}</p>
        </div>
      </div>

      {/* Digital Evidence Details */}
      {(isAccepted || isDisputed) && signature.signed_at && (
        <div className="bg-background rounded-md p-3 space-y-2">
          <h5 className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Evidencia Digital
          </h5>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              Fecha y hora:
            </div>
            <div className="font-medium">
              {new Date(signature.signed_at).toLocaleString('es-ES', {
                dateStyle: 'full',
                timeStyle: 'medium',
              })}
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="h-4 w-4" />
              Dirección IP:
            </div>
            <div className="font-mono text-xs bg-muted px-2 py-1 rounded w-fit">
              {signature.ip_address || 'No disponible'}
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Monitor className="h-4 w-4" />
              Navegador:
            </div>
            <div className="text-xs truncate" title={signature.user_agent}>
              {signature.user_agent ? signature.user_agent.substring(0, 50) + '...' : 'No disponible'}
            </div>
          </div>

          {/* Specialist Comments */}
          {signature.specialist_comments && (
            <div className="pt-2 border-t mt-2">
              <p className="text-sm text-muted-foreground mb-1">Comentarios del especialista:</p>
              <p className="text-sm bg-muted p-2 rounded">{signature.specialist_comments}</p>
            </div>
          )}

          {/* Dispute Reason */}
          {isDisputed && signature.dispute_reason && (
            <div className="pt-2 border-t mt-2">
              <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-500" />
                Motivo de la disputa:
              </p>
              <p className="text-sm bg-red-50 text-red-800 p-2 rounded border border-red-200">
                {signature.dispute_reason}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pending Status Info */}
      {isPending && !isExpired && (
        <div className="bg-background rounded-md p-3 text-sm">
          <p className="text-muted-foreground">
            Se ha enviado un enlace de firma al especialista. El enlace expira el{' '}
            <strong>{new Date(signature.expires_at).toLocaleDateString('es-ES')}</strong>.
          </p>
        </div>
      )}

      {/* Expired Status Info */}
      {isPending && isExpired && (
        <div className="bg-background rounded-md p-3 text-sm">
          <p className="text-muted-foreground">
            El enlace de firma expiró el{' '}
            <strong>{new Date(signature.expires_at).toLocaleDateString('es-ES')}</strong>.
            Puedes reenviar el email para generar un nuevo enlace.
          </p>
        </div>
      )}
    </div>
  );
};

export const LiquidationFormModal = ({ isOpen, onClose, liquidation, mode }: LiquidationFormModalProps) => {
  const queryClient = useQueryClient();
  const isViewMode = mode === 'view';
  const isEditable = mode === 'create' || (mode === 'edit' && (liquidation?.status === 'draft' || liquidation?.status === 'validated'));
  const [selectedRequests, setSelectedRequests] = useState<Array<{ id: string; cost: number }>>([]);
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  const [newManualDescription, setNewManualDescription] = useState('');
  const [newManualAmount, setNewManualAmount] = useState<number | ''>('');

  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm<LiquidationFormData>({
    resolver: zodResolver(liquidationSchema),
    defaultValues: {
      specialist_id: '',
      period_year: new Date().getFullYear(),
      period_month: new Date().getMonth() + 1,
      status: 'draft',
      notes: '',
    },
  });

  const { data: specialists } = useQuery({
    queryKey: ['specialists-active'],
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

  const selectedSpecialistId = watch('specialist_id');
  const selectedYear = watch('period_year');
  const selectedMonth = watch('period_month');

  // Obtener requests pendientes de liquidación para el especialista seleccionado
  const { data: pendingRequests, refetch: refetchPendingRequests } = useUnliquidatedRequests(
    isEditable && selectedSpecialistId ? selectedSpecialistId : undefined
  );

  // Calcular subtotal automáticamente desde los requests seleccionados + items manuales
  const calculatedSubtotal = useMemo(() => {
    const requestsTotal = selectedRequests.reduce((sum, req) => sum + req.cost, 0);
    const manualTotal = manualItems.reduce((sum, item) => sum + item.amount, 0);
    return requestsTotal + manualTotal;
  }, [selectedRequests, manualItems]);

  // Verificar si ya existe una liquidación para el mismo especialista y período
  const { data: existingLiquidation } = useQuery({
    queryKey: ['check-liquidation', selectedSpecialistId, selectedYear, selectedMonth],
    queryFn: async () => {
      if (!selectedSpecialistId || !selectedYear || !selectedMonth) return null;
      
      let query = supabase
        .from('liquidations')
        .select('id')
        .eq('specialist_id', selectedSpecialistId)
        .eq('period_year', selectedYear)
        .eq('period_month', selectedMonth);

      // Si estamos editando, excluir la liquidación actual
      if (mode === 'edit' && liquidation?.id) {
        query = query.neq('id', liquidation.id);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!selectedSpecialistId && !!selectedYear && !!selectedMonth,
  });

  // Función para obtener coste sugerido de un request
  const getSuggestedCost = (request: any): number => {
    if (request.cost_type === 'hourly' && request.hours && request.cost_rate) {
      return request.hours * request.cost_rate;
    }
    return request.fixed_cost || request.cost_to_agency || 0;
  };

  useEffect(() => {
    if (liquidation && isOpen) {
      reset({
        specialist_id: liquidation.specialist_id,
        period_year: liquidation.period_year,
        period_month: liquidation.period_month,
        status: liquidation.status,
        notes: liquidation.notes || '',
      });
    } else if (!liquidation && isOpen) {
      reset({
        specialist_id: '',
        period_year: new Date().getFullYear(),
        period_month: new Date().getMonth() + 1,
        status: 'draft',
        notes: '',
      });
    }
    setSelectedRequests([]);
    setManualItems([]);
    setNewManualDescription('');
    setNewManualAmount('');
  }, [liquidation, isOpen, reset]);

  const createMutation = useMutation({
    mutationFn: async ({ data, requests, manualItemsToSave }: { 
      data: LiquidationFormData; 
      requests: Array<{ id: string; cost: number }>;
      manualItemsToSave: ManualItem[];
    }) => {
      // Calcular subtotal desde los requests y items manuales
      const requestsSubtotal = requests.reduce((sum, req) => sum + req.cost, 0);
      const manualSubtotal = manualItemsToSave.reduce((sum, item) => sum + item.amount, 0);
      const subtotal = requestsSubtotal + manualSubtotal;
      
      // Crear la liquidación
      const { data: newLiquidation, error: createError } = await supabase
        .from('liquidations')
        .insert({
          code: '', // Se genera automáticamente por el trigger
          specialist_id: data.specialist_id,
          period_year: data.period_year,
          period_month: data.period_month,
          status: data.status,
          subtotal: subtotal,
          tax_rate: 0,
          tax_amount: 0,
          total_amount: subtotal,
          notes: data.notes,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Si hay requests seleccionados, crear los items y actualizar los requests
      if (requests.length > 0) {
        // Obtener los requests seleccionados con sus datos
        const { data: requestsData, error: fetchError } = await supabase
          .from('financial_requests')
          .select('*, service:services(name)')
          .in('id', requests.map(r => r.id));

        if (fetchError) throw fetchError;
        if (!requestsData) throw new Error('No se encontraron las solicitudes');

        // Crear liquidation_items - quantity siempre 1 (representa 1 solicitud)
        // El coste ya viene calculado (horas × tarifa o coste fijo)
        const items = requestsData.map((req) => {
          const editedCost = requests.find(r => r.id === req.id)?.cost || 0;
          return {
            liquidation_id: newLiquidation.id,
            financial_request_id: req.id,
            description: req.service?.name || req.title,
            quantity: 1,
            unit_price: editedCost,
            total: editedCost,
          };
        });

        const { error: insertError } = await supabase
          .from('liquidation_items')
          .insert(items);

        if (insertError) throw insertError;

        // Actualizar los requests para marcarlos como liquidados
        const { error: updateError } = await supabase
          .from('financial_requests')
          .update({ liquidation_id: newLiquidation.id })
          .in('id', requests.map(r => r.id));

        if (updateError) throw updateError;
      }

      // Crear items manuales
      if (manualItemsToSave.length > 0) {
        const manualItemsData = manualItemsToSave.map((item) => ({
          liquidation_id: newLiquidation.id,
          financial_request_id: null,
          description: item.description,
          quantity: 1,
          unit_price: item.amount,
          total: item.amount,
        }));

        const { error: insertManualError } = await supabase
          .from('liquidation_items')
          .insert(manualItemsData);

        if (insertManualError) throw insertManualError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      queryClient.invalidateQueries({ queryKey: ['unliquidated-requests'] });
      toast.success('Liquidación creada exitosamente');
      onClose();
    },
    onError: (error) => {
      toast.error('Error al crear liquidación: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: LiquidationFormData) => {
      const { error } = await supabase
        .from('liquidations')
        .update({
          specialist_id: data.specialist_id,
          period_year: data.period_year,
          period_month: data.period_month,
          status: data.status,
          notes: data.notes,
        })
        .eq('id', liquidation.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      toast.success('Liquidación actualizada exitosamente');
      onClose();
    },
    onError: (error) => {
      toast.error('Error al actualizar liquidación: ' + error.message);
    },
  });

  const addRequestsMutation = useMutation({
    mutationFn: async (requests: Array<{ id: string; cost: number }>) => {
      if (!liquidation?.id) throw new Error('Liquidación no encontrada');

      // Obtener los requests seleccionados con sus datos
      const { data: requestsData, error: fetchError } = await supabase
        .from('financial_requests')
        .select('*, service:services(name)')
        .in('id', requests.map(r => r.id));

      if (fetchError) throw fetchError;
      if (!requestsData) throw new Error('No se encontraron las solicitudes');

      // Crear liquidation_items - quantity siempre 1 (representa 1 solicitud)
      // El coste ya viene calculado (horas × tarifa o coste fijo)
      const items = requestsData.map((req) => {
        const editedCost = requests.find(r => r.id === req.id)?.cost || 0;
        return {
          liquidation_id: liquidation.id,
          financial_request_id: req.id,
          description: req.service?.name || req.title,
          quantity: 1,
          unit_price: editedCost,
          total: editedCost,
        };
      });

      const { error: insertError } = await supabase
        .from('liquidation_items')
        .insert(items);

      if (insertError) throw insertError;

      // Actualizar los requests para marcarlos como liquidados
      const { error: updateError } = await supabase
        .from('financial_requests')
        .update({ liquidation_id: liquidation.id })
        .in('id', requests.map(r => r.id));

      if (updateError) throw updateError;

      // Recalcular totales de la liquidación
      const { data: allItems, error: itemsError } = await supabase
        .from('liquidation_items')
        .select('total')
        .eq('liquidation_id', liquidation.id);

      if (itemsError) throw itemsError;

      const newSubtotal = allItems?.reduce((sum, item) => sum + Number(item.total), 0) || 0;

      const { error: updateLiquidationError } = await supabase
        .from('liquidations')
        .update({
          subtotal: newSubtotal,
          tax_amount: 0,
          total_amount: newSubtotal,
        })
        .eq('id', liquidation.id);

      if (updateLiquidationError) throw updateLiquidationError;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      await queryClient.invalidateQueries({ queryKey: ['liquidation-items', liquidation?.id] });
      await queryClient.invalidateQueries({ queryKey: ['unliquidated-requests'] });
      toast.success('Solicitudes agregadas a la liquidación');
      setSelectedRequests([]);
      refetchPendingRequests();
    },
    onError: (error) => {
      toast.error('Error al agregar solicitudes: ' + error.message);
    },
  });

  // Mutation para agregar item manual en modo edit
  const addManualItemMutation = useMutation({
    mutationFn: async (item: { description: string; amount: number }) => {
      if (!liquidation?.id) throw new Error('Liquidación no encontrada');

      const { error: insertError } = await supabase
        .from('liquidation_items')
        .insert({
          liquidation_id: liquidation.id,
          financial_request_id: null,
          description: item.description,
          quantity: 1,
          unit_price: item.amount,
          total: item.amount,
        });

      if (insertError) throw insertError;

      // Recalcular totales
      const { data: allItems, error: itemsError } = await supabase
        .from('liquidation_items')
        .select('total')
        .eq('liquidation_id', liquidation.id);

      if (itemsError) throw itemsError;

      const newSubtotal = allItems?.reduce((sum, i: any) => sum + (Number(i.total) || 0), 0) || 0;

      const { error: updateError } = await supabase
        .from('liquidations')
        .update({ subtotal: newSubtotal, total_amount: newSubtotal })
        .eq('id', liquidation.id);

      if (updateError) throw updateError;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      await queryClient.invalidateQueries({ queryKey: ['liquidation-items', liquidation?.id] });
      toast.success('Item agregado');
      setNewManualDescription('');
      setNewManualAmount('');
    },
    onError: (error) => {
      toast.error('Error al agregar item: ' + error.message);
    },
  });

  // Mutation para eliminar un item de la liquidación
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!liquidation?.id) throw new Error('Liquidación no encontrada');

      // Obtener el item para verificar si tiene un financial_request vinculado
      const { data: item, error: fetchError } = await supabase
        .from('liquidation_items')
        .select('financial_request_id')
        .eq('id', itemId)
        .single();

      if (fetchError) throw fetchError;

      // Eliminar el item
      const { error: deleteError } = await supabase
        .from('liquidation_items')
        .delete()
        .eq('id', itemId);

      if (deleteError) throw deleteError;

      // Si tenía un financial_request, actualizar su estado
      if (item?.financial_request_id) {
        const { error: updateRequestError } = await supabase
          .from('financial_requests')
          .update({ liquidation_id: null })
          .eq('id', item.financial_request_id);

        if (updateRequestError) throw updateRequestError;
      }

      // Recalcular totales
      const { data: allItems, error: itemsError } = await supabase
        .from('liquidation_items')
        .select('total')
        .eq('liquidation_id', liquidation.id);

      if (itemsError) throw itemsError;

      const newSubtotal = allItems?.reduce((sum, i: any) => sum + (Number(i.total) || 0), 0) || 0;

      const { error: updateError } = await supabase
        .from('liquidations')
        .update({ subtotal: newSubtotal, total_amount: newSubtotal })
        .eq('id', liquidation.id);

      if (updateError) throw updateError;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      await queryClient.invalidateQueries({ queryKey: ['liquidation-items', liquidation?.id] });
      await queryClient.invalidateQueries({ queryKey: ['unliquidated-requests'] });
      toast.success('Item eliminado');
    },
    onError: (error) => {
      toast.error('Error al eliminar item: ' + error.message);
    },
  });

  // Mutation para actualizar el coste de un item
  const updateItemCostMutation = useMutation({
    mutationFn: async ({ itemId, newCost, isManual }: { itemId: string; newCost: number; isManual: boolean }) => {
      if (!liquidation?.id) throw new Error('Liquidación no encontrada');

      // Actualizar el item
      const { error: updateItemError } = await supabase
        .from('liquidation_items')
        .update({ 
          unit_price: newCost, 
          total: newCost 
        })
        .eq('id', itemId);

      if (updateItemError) throw updateItemError;

      // Si no es manual, también actualizar el cost_to_agency del financial_request
      if (!isManual) {
        const { data: item } = await supabase
          .from('liquidation_items')
          .select('financial_request_id')
          .eq('id', itemId)
          .single();

        if (item?.financial_request_id) {
          const { error: updateRequestError } = await supabase
            .from('financial_requests')
            .update({ cost_to_agency: newCost })
            .eq('id', item.financial_request_id);

          if (updateRequestError) throw updateRequestError;
        }
      }

      // Recalcular totales
      const { data: allItems, error: itemsError } = await supabase
        .from('liquidation_items')
        .select('total')
        .eq('liquidation_id', liquidation.id);

      if (itemsError) throw itemsError;

      const newSubtotal = allItems?.reduce((sum, i: any) => sum + (Number(i.total) || 0), 0) || 0;

      const { error: updateError } = await supabase
        .from('liquidations')
        .update({ subtotal: newSubtotal, total_amount: newSubtotal })
        .eq('id', liquidation.id);

      if (updateError) throw updateError;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      await queryClient.invalidateQueries({ queryKey: ['liquidation-items', liquidation?.id] });
      toast.success('Coste actualizado');
    },
    onError: (error) => {
      toast.error('Error al actualizar coste: ' + error.message);
    },
  });

  const handleToggleRequest = (requestId: string, isChecked: boolean) => {
    if (isChecked) {
      const request = pendingRequests?.find(r => r.id === requestId);
      const suggestedCost = request ? getSuggestedCost(request) : 0;
      setSelectedRequests((prev) => [...prev, { id: requestId, cost: suggestedCost }]);
    } else {
      setSelectedRequests((prev) => prev.filter((r) => r.id !== requestId));
    }
  };

  const handleCostChange = (requestId: string, newCost: number) => {
    setSelectedRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, cost: newCost } : r))
    );
  };

  const handleAddSelectedRequests = () => {
    if (selectedRequests.length === 0) {
      toast.error('Selecciona al menos una solicitud');
      return;
    }
    addRequestsMutation.mutate(selectedRequests);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && pendingRequests) {
      const allRequests = pendingRequests.map(req => ({
        id: req.id,
        cost: getSuggestedCost(req),
      }));
      setSelectedRequests(allRequests);
    } else {
      setSelectedRequests([]);
    }
  };

  // Handlers para items manuales
  const handleAddManualItem = () => {
    if (!newManualDescription.trim()) {
      toast.error('Ingresa un concepto');
      return;
    }
    if (!newManualAmount || newManualAmount <= 0) {
      toast.error('Ingresa un importe válido');
      return;
    }

    if (mode === 'edit') {
      addManualItemMutation.mutate({ description: newManualDescription, amount: newManualAmount });
    } else {
      // En modo create, solo agregamos al estado local
      setManualItems(prev => [...prev, {
        id: crypto.randomUUID(),
        description: newManualDescription,
        amount: newManualAmount,
      }]);
      setNewManualDescription('');
      setNewManualAmount('');
    }
  };

  const handleRemoveManualItem = (itemId: string) => {
    setManualItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Query para cargar items de la liquidación (para PDF y para modo edición)
  const { data: liquidationItems, refetch: refetchLiquidationItems } = useQuery({
    queryKey: ['liquidation-items', liquidation?.id],
    queryFn: async () => {
      if (!liquidation?.id) return [];
      
      const { data, error } = await supabase
        .from('liquidation_items')
        .select('*, financial_request:financial_requests(code, title, cost_to_agency, client:clients(name))')
        .eq('liquidation_id', liquidation.id)
        .order('created_at');
      
      if (error) throw error;
      return data;
    },
    enabled: (isViewMode || mode === 'edit') && !!liquidation?.id,
  });

  // Agrupar items por cliente (items manuales van a "Otros conceptos")
  const itemsGroupedByClient = useMemo(() => {
    if (!liquidationItems) return [];
    
    const grouped: { [clientName: string]: { items: typeof liquidationItems; subtotal: number } } = {};
    
    liquidationItems.forEach((item) => {
      // Items sin financial_request son manuales
      const clientName = item.financial_request_id 
        ? (item.financial_request?.client?.name || 'Sin cliente')
        : 'Otros conceptos';
      if (!grouped[clientName]) {
        grouped[clientName] = { items: [], subtotal: 0 };
      }
      grouped[clientName].items.push(item);
      // Usar el campo total del item, que es el valor definitivo
      grouped[clientName].subtotal += Number(item.total) || 0;
    });
    
    return Object.entries(grouped).map(([clientName, data]) => ({
      clientName,
      items: data.items,
      subtotal: data.subtotal,
    }));
  }, [liquidationItems]);

  // Calcular subtotal existente en modo edit (usando el campo total del item)
  const existingSubtotal = useMemo(() => {
    if (mode === 'edit' && liquidationItems) {
      return liquidationItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    }
    return 0;
  }, [liquidationItems, mode]);

  // Subtotal total - calculado siempre desde los items para consistencia
  const displaySubtotal = useMemo(() => {
    if ((isViewMode || mode === 'edit') && liquidationItems && liquidationItems.length > 0) {
      // Calcular desde el campo total de los items para que sea consistente
      return liquidationItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0) + calculatedSubtotal;
    }
    return calculatedSubtotal;
  }, [liquidationItems, calculatedSubtotal, isViewMode, mode]);

  const handleDownloadPDF = async () => {
    if (!liquidation || !liquidationItems) {
      toast.error('No hay datos para generar el PDF');
      return;
    }

    const specialist = specialists?.find((s) => s.id === liquidation.specialist_id);
    if (!specialist) {
      toast.error('Especialista no encontrado');
      return;
    }

    try {
      await generateLiquidationPDF({
        liquidation,
        items: liquidationItems,
        specialist,
      });
      toast.success('PDF generado correctamente');
    } catch (error: any) {
      toast.error('Error al generar PDF: ' + error.message);
    }
  };

  const onSubmit = (data: LiquidationFormData) => {
    if (existingLiquidation) {
      toast.error('Ya existe una liquidación para este especialista y período');
      return;
    }

    if (mode === 'create') {
      createMutation.mutate({ data, requests: selectedRequests, manualItemsToSave: manualItems });
    } else if (mode === 'edit') {
      updateMutation.mutate(data);
    }
  };

  const getTitle = () => {
    if (mode === 'view') return 'Ver Liquidación';
    if (mode === 'edit') return 'Editar Liquidación';
    return 'Nueva Liquidación';
  };

  const allSelected = pendingRequests && pendingRequests.length > 0 && 
    selectedRequests.length === pendingRequests.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        {mode === 'edit' && liquidation?.status !== 'draft' && (
          <div className="bg-muted p-3 rounded-md text-sm text-muted-foreground">
            Esta liquidación no se puede editar porque su estado no es borrador
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="specialist_id">Especialista *</Label>
            <Select
              value={watch('specialist_id')}
              onValueChange={(value) => {
                setValue('specialist_id', value);
                setSelectedRequests([]); // Reset selected when specialist changes
              }}
              disabled={isViewMode || !isEditable}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar especialista" />
              </SelectTrigger>
              <SelectContent>
                {specialists?.map((specialist) => (
                  <SelectItem key={specialist.id} value={specialist.id}>
                    {specialist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.specialist_id && (
              <p className="text-sm text-destructive mt-1">{errors.specialist_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="period_year">Año *</Label>
              <Select
                value={watch('period_year').toString()}
                onValueChange={(value) => setValue('period_year', parseInt(value))}
                disabled={isViewMode || !isEditable}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.period_year && (
                <p className="text-sm text-destructive mt-1">{errors.period_year.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="period_month">Mes *</Label>
              <Select
                value={watch('period_month').toString()}
                onValueChange={(value) => setValue('period_month', parseInt(value))}
                disabled={isViewMode || !isEditable}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <SelectItem key={month} value={month.toString()}>
                      {formatPeriod(2024, month, 'long').split(' ')[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.period_month && (
                <p className="text-sm text-destructive mt-1">{errors.period_month.message}</p>
              )}
            </div>
          </div>

          {existingLiquidation && mode === 'create' && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
              Ya existe una liquidación para este especialista en {formatPeriod(selectedYear, selectedMonth)}
            </div>
          )}

          <div>
            <Label htmlFor="status">Estado *</Label>
            <Select
              value={watch('status')}
              onValueChange={(value) => setValue('status', value as LiquidationStatus)}
              disabled={isViewMode || !isEditable}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="validated">Validada</SelectItem>
                <SelectItem value="sent">Enviada</SelectItem>
                <SelectItem value="accepted">Aceptada</SelectItem>
                <SelectItem value="pending_payment">Pendiente de pago</SelectItem>
                <SelectItem value="paid">Pagada</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && (
              <p className="text-sm text-destructive mt-1">{errors.status.message}</p>
            )}
          </div>

          {/* Items existentes de la liquidación - Visible en VIEW y EDIT */}
          {(isViewMode || mode === 'edit') && itemsGroupedByClient.length > 0 && (
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="text-base font-semibold">
                Solicitudes incluidas ({liquidationItems?.length || 0})
              </Label>
              
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4 pb-2">
                  {itemsGroupedByClient.map((group) => (
                    <div key={group.clientName} className="border rounded-md overflow-hidden">
                      {/* Encabezado del cliente */}
                      <div className="bg-muted px-3 py-2 flex justify-between items-center">
                        <span className="font-medium text-sm">{group.clientName}</span>
                        <span className="font-semibold text-sm">{group.subtotal.toFixed(2)} €</span>
                      </div>
                      
                      {/* Items del cliente */}
                      <div className="divide-y">
                        {group.items.map((item) => {
                          const isManual = !item.financial_request_id;
                          // Usar item.total para consistencia con el subtotal del grupo
                          const currentCost = Number(item.total) || 0;
                          
                          return (
                            <div key={item.id} className="px-3 py-2 flex justify-between items-center text-sm gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center">
                                  <span className="text-muted-foreground mr-2">
                                    {item.financial_request?.code || '-'}
                                  </span>
                                  <span className="truncate">{item.description}</span>
                                </div>
                                {item.financial_request?.title && (
                                  <div className="text-xs text-muted-foreground ml-12 mt-0.5 truncate">
                                    {item.financial_request.title}
                                  </div>
                                )}
                              </div>
                              
                              {isEditable ? (
                                <div className="flex items-center gap-2 shrink-0">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    defaultValue={currentCost}
                                    className="w-24 h-8 text-right"
                                    onBlur={(e) => {
                                      const newCost = parseFloat(e.target.value) || 0;
                                      if (newCost !== currentCost) {
                                        updateItemCostMutation.mutate({ 
                                          itemId: item.id, 
                                          newCost, 
                                          isManual 
                                        });
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                  />
                                  <span className="text-muted-foreground">€</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => deleteItemMutation.mutate(item.id)}
                                    disabled={deleteItemMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-muted-foreground shrink-0">{currentCost.toFixed(2)} €</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Widget de Requests Pendientes - Visible en CREATE y EDIT (borrador) */}
          {isEditable && selectedSpecialistId && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Solicitudes disponibles del especialista
                  {pendingRequests && ` (${pendingRequests.length})`}
                </Label>
                {mode === 'edit' && selectedRequests.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddSelectedRequests}
                    disabled={addRequestsMutation.isPending}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar ({selectedRequests.length})
                  </Button>
                )}
              </div>

              {pendingRequests && pendingRequests.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Checkbox
                      id="select-all"
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                    />
                    <Label htmlFor="select-all" className="text-sm cursor-pointer">
                      Seleccionar todas
                    </Label>
                  </div>
              
                  <ScrollArea className="h-[200px] rounded-md border p-3">
                    <div className="space-y-2">
                      {pendingRequests.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={request.id}
                            checked={selectedRequests.some(r => r.id === request.id)}
                            onCheckedChange={(checked) => handleToggleRequest(request.id, checked as boolean)}
                          />
                          <div className="flex-1 space-y-2">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-sm">{request.code}</span>
                                <div className="text-right">
                                  <span className="text-xs text-muted-foreground">
                                    {request.service?.name}
                                  </span>
                                  {request.title && (
                                    <div className="text-xs text-muted-foreground/70">
                                      {request.title}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Cliente: {request.client?.name}
                                {request.billed_invoice && (
                                  <> • Factura: {
                                    Array.isArray(request.billed_invoice) 
                                      ? request.billed_invoice[0]?.code 
                                      : (request.billed_invoice as any)?.code
                                  }</>
                                )}
                              </div>
                            </div>
                            {selectedRequests.some(r => r.id === request.id) && (
                              <div className="flex items-center gap-2">
                                <Label className="text-xs">Coste (€):</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={selectedRequests.find(r => r.id === request.id)?.cost || 0}
                                  onChange={(e) => handleCostChange(request.id, parseFloat(e.target.value) || 0)}
                                  className="w-32 h-8"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No hay solicitudes pendientes de liquidación para este especialista
                </p>
              )}
              
              <p className="text-xs text-muted-foreground">
                Solicitudes activas o facturadas que aún no han sido liquidadas.
              </p>
            </div>
          )}

          {/* Sección de Items Manuales - Visible en CREATE y EDIT (borrador) */}
          {isEditable && (
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="text-base font-semibold">
                Añadir conceptos manuales
              </Label>
              
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="manual-description" className="text-xs">Concepto</Label>
                  <Input
                    id="manual-description"
                    placeholder="Descripción del concepto"
                    value={newManualDescription}
                    onChange={(e) => setNewManualDescription(e.target.value)}
                  />
                </div>
                <div className="w-32">
                  <Label htmlFor="manual-amount" className="text-xs">Importe (€)</Label>
                  <Input
                    id="manual-amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newManualAmount}
                    onChange={(e) => setNewManualAmount(e.target.value ? parseFloat(e.target.value) : '')}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddManualItem}
                  disabled={addManualItemMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Items manuales pendientes de guardar (solo en modo create) */}
              {mode === 'create' && manualItems.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <Label className="text-sm text-muted-foreground">Conceptos añadidos:</Label>
                  {manualItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-muted/50 rounded-md">
                      <span className="text-sm">{item.description}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.amount.toFixed(2)} €</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveManualItem(item.id)}
                          className="h-6 w-6 p-0"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Añade conceptos adicionales que no estén vinculados a solicitudes.
              </p>
            </div>
          )}

          {/* Totales calculados automáticamente */}
          <div className="bg-muted p-4 rounded-md">
            <div className="flex justify-between text-base font-bold">
              <span>Total:</span>
              <span>{displaySubtotal.toFixed(2)} €</span>
            </div>
          </div>

          {/* Digital Signature Details - Only in View Mode when signature exists */}
          {isViewMode && liquidation?.liquidation_signatures?.[0] && (
            <SignatureDetailsSection signature={liquidation.liquidation_signatures[0]} />
          )}

          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              {...register('notes')}
              rows={3}
              disabled={isViewMode || !isEditable}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {isViewMode ? 'Cerrar' : 'Cancelar'}
            </Button>
            {isViewMode && liquidation && (
              <Button type="button" variant="outline" onClick={handleDownloadPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
            )}
            {!isViewMode && isEditable && (
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
