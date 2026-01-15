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
import { Loader2, Clock, Euro, User, FileText, ShoppingCart } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useRequestActivityLog } from '@/hooks/useRequestActivityLog';
import { notifySpecialistAssigned } from '@/lib/notification-utils';
import { useAuth } from '@/contexts/AuthContext';

const requestSchema = z.object({
  client_id: z.string().uuid('Selecciona un cliente'),
  service_id: z.string().uuid('Selecciona un servicio'),
  specialist_id: z.string().uuid().optional().nullable(),
  contract_id: z.string().uuid().optional().nullable(),
  client_contact_id: z.string().uuid().optional().nullable(),
  title: z.string().min(3, 'Mínimo 3 caracteres').max(255, 'Máximo 255 caracteres'),
  description: z.string().optional().nullable(),
  quantity: z.coerce.number().min(0, 'No puede ser negativo'),
  deadline: z.string().optional().nullable(),
  status: z.enum(['draft', 'pending_specialist', 'pending_approval', 'in_progress', 'pending_review', 'completed', 'cancelled']),
  // Sale/Price fields (to client)
  sale_type: z.enum(['hourly', 'fixed']).default('fixed'),
  unit_price: z.coerce.number().min(0).optional().nullable(),
  sale_rate: z.coerce.number().min(0).optional().nullable(),
  sale_hours: z.coerce.number().min(0).optional().nullable(),
  // Cost fields (to agency)
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
  const { logActivity } = useRequestActivityLog();
  const { user } = useAuth();

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
      // Sale defaults
      sale_type: 'fixed',
      unit_price: null,
      sale_rate: null,
      sale_hours: null,
      // Cost defaults
      cost_type: 'fixed',
      hours: null,
      cost_rate: null,
      fixed_cost: null,
    },
  });

  // Watch sale_type for conditional rendering
  const saleType = useWatch({ control: form.control, name: 'sale_type' });
  const unitPrice = useWatch({ control: form.control, name: 'unit_price' });
  const saleRate = useWatch({ control: form.control, name: 'sale_rate' });
  const saleHours = useWatch({ control: form.control, name: 'sale_hours' });
  const quantity = useWatch({ control: form.control, name: 'quantity' });

  // Watch cost_type to conditionally show fields
  const costType = useWatch({ control: form.control, name: 'cost_type' });
  const hours = useWatch({ control: form.control, name: 'hours' });
  const costRate = useWatch({ control: form.control, name: 'cost_rate' });
  const fixedCost = useWatch({ control: form.control, name: 'fixed_cost' });
  const selectedClientId = useWatch({ control: form.control, name: 'client_id' });

  // Calculate sale amount based on sale_type
  const calculatedSaleAmount = saleType === 'hourly'
    ? (saleHours || 0) * (saleRate || 0)
    : (unitPrice || 0) * (quantity || 1);

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
          .select('id, name, hourly_rate, user_id, email')
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
      // Calculate sale_amount based on sale_type
      const sale_amount = data.sale_type === 'hourly'
        ? (data.sale_hours || 0) * (data.sale_rate || 0)
        : (data.unit_price || 0) * data.quantity;

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
        // Sale fields
        sale_type: data.sale_type,
        unit_price: data.sale_type === 'fixed' ? data.unit_price : null,
        sale_rate: data.sale_type === 'hourly' ? data.sale_rate : null,
        sale_hours: data.sale_type === 'hourly' ? data.sale_hours : null,
        sale_amount,
        // Cost fields
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
        return { isNew: false, id: initialData.id };
      } else {
        const { data: newRequest, error } = await supabase
          .from('financial_requests')
          .insert([requestData as any])
          .select('id, code')
          .single();
        if (error) throw error;
        
        // Get specialist data for notification
        const specialistData = data.specialist_id 
          ? specialists?.find(s => s.id === data.specialist_id)
          : null;
        
        return { 
          isNew: true, 
          id: newRequest?.id,
          code: newRequest?.code,
          specialistData,
          status: data.status,
          clientId: data.client_id,
        };
      }
    },
    onSuccess: async (result) => {
      // Log the activity
      if (result?.id) {
        await logActivity({
          entityId: result.id,
          action: result.isNew ? 'created' : 'updated',
          changes: result.isNew ? { title: form.getValues('title') } : null
        });
      }
      
      // Notify specialist if assigned with pending_specialist status
      if (result?.isNew && result?.specialistData && result?.status === 'pending_specialist') {
        const client = formData?.clients?.find(c => c.id === result.clientId);
        
        // In-app notification (if specialist has user_id)
        if (result.specialistData.user_id) {
          await notifySpecialistAssigned(
            result.specialistData.user_id,
            result.code || `Solicitud`,
            result.id,
            client?.name || 'Cliente'
          );
        }
        
        // Email notification (if specialist has email and sender has @hayas.es email)
        const senderEmail = user?.email;
        if (result.specialistData.email && senderEmail?.endsWith('@hayas.es')) {
          try {
            const appUrl = window.location.origin;
            await supabase.functions.invoke('send-request-notification', {
              body: {
                requestId: result.id,
                notificationType: 'specialist_assigned',
                recipientEmail: result.specialistData.email,
                recipientName: result.specialistData.name || 'Especialista',
                senderEmail,
                appUrl,
              },
            });
          } catch (emailError) {
            console.error('Error sending email notification:', emailError);
            // Don't fail the whole operation if email fails
          }
        }
      }
      
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
        // Pre-fill contact from budget if no contact is set on the request
        const contactToUse = initialData.client_contact_id 
          || initialData.budget?.client_contact_id 
          || null;
        
        form.reset({
          client_id: initialData.client_id,
          service_id: initialData.service_id,
          specialist_id: initialData.specialist_id ?? null,
          contract_id: initialData.contract_id ?? null,
          client_contact_id: contactToUse,
          title: initialData.title,
          description: initialData.description ?? null,
          quantity: initialData.quantity ?? 1,
          deadline: initialData.deadline ?? null,
          status: initialData.status,
          // Sale fields
          sale_type: initialData.sale_type ?? 'fixed',
          unit_price: initialData.unit_price ?? null,
          sale_rate: initialData.sale_rate ?? null,
          sale_hours: initialData.sale_hours ?? null,
          // Cost fields
          cost_type: initialData.cost_type ?? 'fixed',
          hours: initialData.hours ?? null,
          cost_rate: initialData.cost_rate ?? null,
          fixed_cost: initialData.fixed_cost ?? null,
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
          // Sale defaults
          sale_type: 'fixed',
          unit_price: null,
          sale_rate: null,
          sale_hours: null,
          // Cost defaults
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

            {/* Budget Info - Read Only */}
            {initialData?.budget && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Presupuesto vinculado</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{initialData.budget.code}</Badge>
                  <span className="text-sm">{initialData.budget.title}</span>
                </div>
              </div>
            )}

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
                      onValueChange={(value) => {
                        const newValue = value === 'none' ? null : value;
                        field.onChange(newValue);
                        
                        // Auto-fill hourly rate when specialist is selected
                        if (newValue) {
                          const selectedSpecialist = specialists?.find(s => s.id === newValue);
                          if (selectedSpecialist?.hourly_rate && selectedSpecialist.hourly_rate > 0) {
                            const currentCostType = form.getValues('cost_type');
                            const currentCostRate = form.getValues('cost_rate');
                            
                            // Only pre-fill if cost_type is hourly and cost_rate is empty/zero
                            if (currentCostType === 'hourly' && (!currentCostRate || currentCostRate === 0)) {
                              form.setValue('cost_rate', selectedSpecialist.hourly_rate);
                            }
                            
                            // Also pre-fill hours with quantity if hours is empty
                            const currentHours = form.getValues('hours');
                            const currentQuantity = form.getValues('quantity');
                            if ((!currentHours || currentHours === 0) && currentQuantity > 0) {
                              form.setValue('hours', currentQuantity);
                            }
                          }
                        }
                      }}
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
                            {specialist.name} {specialist.hourly_rate ? `(${specialist.hourly_rate}€/h)` : ''}
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

            {/* Sale/Price to Client Section */}
            <Separator />
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Precio al Cliente
              </h3>

              <FormField
                control={form.control}
                name="sale_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Facturación *</FormLabel>
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
                        <SelectItem value="fixed">Precio Fijo</SelectItem>
                        <SelectItem value="hourly">Por Horas</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {saleType === 'hourly' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <FormField
                    control={form.control}
                    name="sale_hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Horas a facturar
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sale_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tarifa/Hora (€)</FormLabel>
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
                    Importe al cliente: <span className="font-semibold text-foreground">{calculatedSaleAmount.toFixed(2)} €</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <FormField
                    control={form.control}
                    name="unit_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Unitario (€)</FormLabel>
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
                        <FormDescription>
                          Precio por unidad a facturar al cliente
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {(quantity || 0) > 1 && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      Importe total: <span className="font-semibold text-foreground">{calculatedSaleAmount.toFixed(2)} €</span> ({quantity} × {(unitPrice || 0).toFixed(2)} €)
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quantity and Deadline */}
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
                        step="0.01"
                        min="0"
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
                      <SelectItem value="pending_specialist">Pend. Especialista</SelectItem>
                      <SelectItem value="pending_approval">Pend. Aprobación</SelectItem>
                      <SelectItem value="in_progress">En Progreso</SelectItem>
                      <SelectItem value="pending_review">Pend. Revisión</SelectItem>
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
