import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';
import { calculateTotal } from '@/lib/request-utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

const requestSchema = z.object({
  client_id: z.string().uuid('Selecciona un cliente'),
  service_id: z.string().uuid('Selecciona un servicio'),
  specialist_id: z.string().uuid().optional().nullable(),
  title: z.string().min(3, 'Mínimo 3 caracteres').max(255, 'Máximo 255 caracteres'),
  description: z.string().optional().nullable(),
  quantity: z.coerce.number().min(1, 'Mínimo 1'),
  unit_price: z.coerce.number().min(0, 'Debe ser positivo'),
  cost: z.coerce.number().min(0).optional().nullable(),
  deadline: z.string().optional().nullable(),
  status: z.enum([
    'draft',
    'pending_approval',
    'approved',
    'in_progress',
    'completed',
    'billed',
    'cancelled',
  ]),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface RequestFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any | null;
  onSuccess: () => void;
  mode?: 'create' | 'edit' | 'view';
}

export const RequestFormModal = ({
  open,
  onOpenChange,
  initialData,
  onSuccess,
  mode = 'create',
}: RequestFormModalProps) => {
  const isViewMode = mode === 'view';

  const [marginWarning, setMarginWarning] = useState(false);

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      client_id: '',
      service_id: '',
      specialist_id: null,
      title: '',
      description: null,
      quantity: 1,
      unit_price: 0,
      cost: null,
      deadline: null,
      status: 'draft',
    },
  });

  // Optimized: Load all data in parallel with Promise.all
  const { data: formData } = useQuery({
    queryKey: ['request-form-data'],
    queryFn: async () => {
      const [clientsRes, servicesRes, specialistsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, code')
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('services')
          .select('id, name, price')
          .eq('active', true)
          .order('name'),
        supabase
          .from('specialists')
          .select('id, name')
          .eq('active', true)
          .order('name'),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (specialistsRes.error) throw specialistsRes.error;

      return {
        clients: clientsRes.data || [],
        services: servicesRes.data || [],
        specialists: specialistsRes.data || [],
      };
    },
  });

  const clients = formData?.clients;
  const services = formData?.services;
  const specialists = formData?.specialists;

  const mutation = useMutation({
    mutationFn: async (data: RequestFormData) => {
      const total = calculateTotal(data.quantity, data.unit_price);
      const margin = data.cost ? total - data.cost : null;

      const requestData = {
        ...data,
        total,
        margin,
        deadline: data.deadline || null,
        description: data.description || null,
        specialist_id: data.specialist_id || null,
        cost: data.cost || null,
      };

      if (initialData) {
        const { error } = await supabase
          .from('requests')
          .update(requestData)
          .eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('requests').insert([requestData as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        initialData ? 'Solicitud actualizada' : 'Solicitud creada correctamente'
      );
      onSuccess();
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al guardar la solicitud');
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        client_id: initialData.client_id,
        service_id: initialData.service_id,
        specialist_id: initialData.specialist_id || null,
        title: initialData.title,
        description: initialData.description || null,
        quantity: initialData.quantity,
        unit_price: initialData.unit_price,
        cost: initialData.cost || null,
        deadline: initialData.deadline || null,
        status: initialData.status,
      });
    } else {
      form.reset();
    }
  }, [initialData, form]);

  // Improved: Pre-populate prices from contract_services first, then services
  const onServiceChange = async (serviceId: string) => {
    const clientId = form.getValues('client_id');
    
    if (!clientId || !serviceId) return;

    try {
      // Priority 1: Load price from active contract_services
      const { data: activeContracts } = await supabase
        .from('contracts')
        .select('id')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (activeContracts && activeContracts.length > 0) {
        const { data: contractService } = await supabase
          .from('contract_services')
          .select('unit_price')
          .eq('contract_id', activeContracts[0].id)
          .eq('service_id', serviceId)
          .maybeSingle();

        if (contractService?.unit_price) {
          console.log(`✅ Pre-populated price from contract: €${contractService.unit_price}`);
          form.setValue('unit_price', contractService.unit_price);
          toast.success('Precio cargado desde contrato activo');
          return;
        }
      }

      // Priority 2: Fallback to base service price
      const service = services?.find((s) => s.id === serviceId);
      if (service?.price) {
        console.log(`✅ Pre-populated price from service: €${service.price}`);
        form.setValue('unit_price', service.price);
      }
    } catch (error) {
      console.error('Error loading price:', error);
      // Fallback to service price on error
      const service = services?.find((s) => s.id === serviceId);
      if (service?.price) {
        form.setValue('unit_price', service.price);
      }
    }
  };

  // Auto-calculate total and margin, show warning if margin is negative
  useEffect(() => {
    const subscription = form.watch((value) => {
      const { quantity, unit_price, cost } = value;

      if (quantity && unit_price && cost) {
        const total = quantity * unit_price;
        const margin = total - (cost * quantity);

        if (margin < 0) {
          setMarginWarning(true);
          console.warn(`⚠️ Negative margin: €${margin.toFixed(2)}`);
        } else {
          setMarginWarning(false);
        }

        console.log(
          `💰 Total: €${total.toFixed(2)} | Cost: €${(cost * quantity).toFixed(2)} | Margin: €${margin.toFixed(2)}`
        );
      } else {
        setMarginWarning(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = (data: RequestFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isViewMode
              ? 'Detalles de Solicitud'
              : initialData
              ? 'Editar Solicitud'
              : 'Nueva Solicitud'}
          </DialogTitle>
          <DialogDescription>
            {isViewMode
              ? 'Información completa de la solicitud'
              : initialData
              ? 'Modifica los datos de la solicitud'
              : 'Completa los datos para crear una nueva solicitud'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {marginWarning && !isViewMode && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  ⚠️ <strong>Margen negativo:</strong> El costo es mayor que el precio de venta. Estás perdiendo dinero en esta solicitud.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isViewMode}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name} ({client.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="service_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Servicio *</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        onServiceChange(value);
                      }}
                      defaultValue={field.value}
                      disabled={isViewMode}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar servicio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {services?.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Título de la solicitud"
                      {...field}
                      disabled={isViewMode}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descripción detallada"
                      {...field}
                      value={field.value || ''}
                      disabled={isViewMode}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cantidad *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        disabled={isViewMode}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio Unitario *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...field}
                        disabled={isViewMode}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...field}
                        value={field.value || ''}
                        disabled={isViewMode}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="specialist_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialista</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value || ''}
                      disabled={isViewMode}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="null">Sin asignar</SelectItem>
                        {specialists?.map((specialist) => (
                          <SelectItem key={specialist.id} value={specialist.id}>
                            {specialist.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Límite</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ''}
                        disabled={isViewMode}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isViewMode}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Borrador</SelectItem>
                      <SelectItem value="pending_approval">Pendiente Aprobación</SelectItem>
                      <SelectItem value="approved">Aprobado</SelectItem>
                      <SelectItem value="in_progress">En Progreso</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isViewMode && (
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {initialData ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
