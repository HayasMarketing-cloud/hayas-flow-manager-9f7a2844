import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
  FormDescription,
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
import { Loader2, Clock, Euro, User } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const requestSchema = z.object({
  client_id: z.string().uuid('Selecciona un cliente'),
  service_id: z.string().uuid('Selecciona un servicio'),
  specialist_id: z.string().uuid().optional().nullable(),
  contract_id: z.string().uuid().optional().nullable(),
  client_contact_id: z.string().uuid().optional().nullable(),
  title: z.string().min(3, 'Mínimo 3 caracteres').max(255, 'Máximo 255 caracteres'),
  description: z.string().optional().nullable(),
  quantity: z.coerce.number().min(1, 'Mínimo 1'),
  deadline: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'invoiced', 'liquidated']),
  // Cost fields
  cost_type: z.enum(['hourly', 'fixed']).default('fixed'),
  hours: z.coerce.number().min(0).optional().nullable(),
  cost_rate: z.coerce.number().min(0).optional().nullable(),
  fixed_cost: z.coerce.number().min(0).optional().nullable(),
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

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      client_id: '',
      service_id: '',
      specialist_id: null,
      contract_id: null,
      client_contact_id: null,
      title: '',
      description: null,
      quantity: 1,
      deadline: null,
      status: 'draft',
      cost_type: 'fixed',
      hours: null,
      cost_rate: null,
      fixed_cost: null,
    },
  });

  // Watch cost_type to conditionally show fields
  const costType = useWatch({ control: form.control, name: 'cost_type' });
  const hours = useWatch({ control: form.control, name: 'hours' });
  const costRate = useWatch({ control: form.control, name: 'cost_rate' });
  const fixedCost = useWatch({ control: form.control, name: 'fixed_cost' });
  const selectedClientId = useWatch({ control: form.control, name: 'client_id' });

  // Calculate cost to agency
  const calculatedCost = costType === 'hourly' 
    ? (hours || 0) * (costRate || 0)
    : (fixedCost || 0);

  // Load form data
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
          .select('id, name')
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

  // Load contracts for selected client
  const { data: contracts } = useQuery({
    queryKey: ['contracts-for-client', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data, error } = await supabase
        .from('contracts')
        .select('id, title')
        .eq('client_id', selectedClientId)
        .eq('status', 'active')
        .order('title');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClientId,
  });

  // Load contacts for selected client
  const { data: contacts } = useQuery({
    queryKey: ['contacts-for-client', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data, error } = await supabase
        .from('client_contacts')
        .select('id, name, email, role')
        .eq('client_id', selectedClientId)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClientId,
  });

  const clients = formData?.clients;
  const services = formData?.services;
  const specialists = formData?.specialists;

  const mutation = useMutation({
    mutationFn: async (data: RequestFormData) => {
      // Calculate cost_to_agency based on cost_type
      const cost_to_agency = data.cost_type === 'hourly'
        ? (data.hours || 0) * (data.cost_rate || 0)
        : (data.fixed_cost || 0);

      const requestData = {
        client_id: data.client_id,
        service_id: data.service_id,
        specialist_id: data.specialist_id || null,
        contract_id: data.contract_id || null,
        client_contact_id: data.client_contact_id || null,
        title: data.title,
        description: data.description || null,
        quantity: data.quantity,
        deadline: data.deadline || null,
        status: data.status,
        cost_type: data.cost_type,
        hours: data.cost_type === 'hourly' ? data.hours : null,
        cost_rate: data.cost_type === 'hourly' ? data.cost_rate : null,
        fixed_cost: data.cost_type === 'fixed' ? data.fixed_cost : null,
        cost_to_agency,
      };

      if (initialData) {
        const { error } = await supabase
          .from('financial_requests')
          .update(requestData)
          .eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_requests').insert([requestData as any]);
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
    if (open) {
      if (initialData) {
        form.reset({
          client_id: initialData.client_id,
          service_id: initialData.service_id,
          specialist_id: initialData.specialist_id || null,
          contract_id: initialData.contract_id || null,
          client_contact_id: initialData.client_contact_id || null,
          title: initialData.title,
          description: initialData.description || null,
          quantity: initialData.quantity,
          deadline: initialData.deadline || null,
          status: initialData.status,
          cost_type: initialData.cost_type || 'fixed',
          hours: initialData.hours || null,
          cost_rate: initialData.cost_rate || null,
          fixed_cost: initialData.fixed_cost || null,
        });
      } else {
        form.reset({
          client_id: '',
          service_id: '',
          specialist_id: null,
          contract_id: null,
          client_contact_id: null,
          title: '',
          description: null,
          quantity: 1,
          deadline: null,
          status: 'draft',
          cost_type: 'fixed',
          hours: null,
          cost_rate: null,
          fixed_cost: null,
        });
      }
    }
  }, [open, initialData, form]);

  // Clear contract and contact when client changes
  useEffect(() => {
    if (selectedClientId) {
      // Check if current contract belongs to selected client
      const currentContractId = form.getValues('contract_id');
      if (currentContractId && contracts && !contracts.find(c => c.id === currentContractId)) {
        form.setValue('contract_id', null);
      }
      // Check if current contact belongs to selected client
      const currentContactId = form.getValues('client_contact_id');
      if (currentContactId && contacts && !contacts.find(c => c.id === currentContactId)) {
        form.setValue('client_contact_id', null);
      }
    }
  }, [selectedClientId, contracts, contacts, form]);

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
            {/* Client & Contract */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
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
                name="contract_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contrato</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                      value={field.value || 'none'}
                      disabled={isViewMode || !selectedClientId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin contrato" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin contrato</SelectItem>
                        {contracts?.map((contract) => (
                          <SelectItem key={contract.id} value={contract.id}>
                            {contract.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Vincular a un contrato para precios predefinidos
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Contact Selector */}
            <FormField
              control={form.control}
              name="client_contact_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Contacto Solicitante
                  </FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                    value={field.value || 'none'}
                    disabled={isViewMode || !selectedClientId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin especificar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sin especificar</SelectItem>
                      {contacts?.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name} {contact.role ? `(${contact.role})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Persona de la empresa que solicita este trabajo
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="service_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Servicio *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
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

              <FormField
                control={form.control}
                name="specialist_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialista</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                      value={field.value || 'none'}
                      disabled={isViewMode}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cantidad (unidades) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        disabled={isViewMode}
                      />
                    </FormControl>
                    <FormDescription>
                      Unidades de servicio (ej: 3 posts, 2 sesiones)
                    </FormDescription>
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

            <Separator />

            {/* Cost Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Coste para la Agencia
              </h3>

              <FormField
                control={form.control}
                name="cost_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Coste *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isViewMode}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fixed">Coste Fijo</SelectItem>
                        <SelectItem value="hourly">Por Horas</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {costType === 'hourly' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <FormField
                    control={form.control}
                    name="hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Horas *
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            disabled={isViewMode}
                          />
                        </FormControl>
                        <FormDescription>
                          Permite decimales (ej: 0.5 = 30 min)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cost_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tarifa/Hora (€) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            disabled={isViewMode}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="md:col-span-2 text-sm text-muted-foreground">
                    Coste calculado: <span className="font-semibold text-foreground">{calculatedCost.toFixed(2)} €</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <FormField
                    control={form.control}
                    name="fixed_cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coste Fijo (€)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            disabled={isViewMode}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <Separator />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isViewMode}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Borrador</SelectItem>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="invoiced">Facturado</SelectItem>
                      <SelectItem value="liquidated">Liquidado</SelectItem>
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
