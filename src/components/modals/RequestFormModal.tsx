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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Clock, Euro, User, FileText, ShoppingCart, Info } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useRequestActivityLog } from '@/hooks/useRequestActivityLog';
import { notifySpecialistAssigned } from '@/lib/notification-utils';
import { notificationFeedback } from '@/lib/notification-feedback';
import { useAuth } from '@/contexts/AuthContext';

import { useDefaultRates, getRateSourceLabel } from '@/hooks/useDefaultRates';

const requestSchema = z.object({
  client_id: z.string().uuid('Selecciona un cliente'),
  service_id: z.string().uuid('Selecciona un servicio'),
  specialist_id: z.string().uuid().optional().nullable(),
  contract_id: z.string().uuid().optional().nullable(),
  budget_id: z.string().uuid().optional().nullable(),
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
  // Partner reference (for partners like Wolfestone)
  partner_reference: z.string().max(100).optional().nullable(),
}).refine(
  (data) => !!(data.contract_id || data.budget_id),
  {
    message: 'Debes seleccionar un contrato o un presupuesto como origen',
    path: ['contract_id'],
  }
);

// Normaliza coma decimal a punto y parsea como número (o null si vacío)
const parseNum = (val: string): number | null => {
  if (val === '' || val === null || val === undefined) return null;
  const normalized = String(val).replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
};

// Castea valores numeric provenientes de Supabase (string) a number
const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return isNaN(n) ? null : n;
};


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
  const isCreateMode = mode === 'create';
  const { logActivity } = useRequestActivityLog();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      client_id: '',
      service_id: '',
      specialist_id: null,
      contract_id: null,
      budget_id: null,
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
      // Partner reference
      partner_reference: null,
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
  const selectedContractId = useWatch({ control: form.control, name: 'contract_id' });
  const selectedBudgetId = useWatch({ control: form.control, name: 'budget_id' });
  const selectedServiceId = useWatch({ control: form.control, name: 'service_id' });
  const selectedSpecialistId = useWatch({ control: form.control, name: 'specialist_id' });

  // Get default rates based on hierarchy
  const { data: defaultRates, isLoading: isLoadingRates } = useDefaultRates(
    selectedClientId || null,
    selectedContractId || null,
    selectedServiceId || null,
    selectedSpecialistId || null
  );

  // Load form data
  const { data: formData } = useQuery({
    queryKey: ['request-form-data'],
    queryFn: async () => {
      const [clientsRes, servicesRes, specialistsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, code, default_hourly_rate')
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

  // In create mode, use suggested rates for calculations
  const effectiveSaleRate = isCreateMode ? (defaultRates?.saleRate ?? 0) : (saleRate || 0);
  const effectiveCostRate = isCreateMode ? (defaultRates?.costRate ?? 0) : (costRate || 0);

  // Calculate sale amount based on sale_type
  const calculatedSaleAmount = saleType === 'hourly'
    ? (saleHours || 0) * effectiveSaleRate
    : (unitPrice || 0) * (quantity || 1);

  // Calculate cost to agency
  const calculatedCost = costType === 'hourly' 
    ? (hours || 0) * effectiveCostRate
    : (fixedCost || 0);

  // Get names for rate source labels
  const selectedClient = formData?.clients?.find(c => c.id === selectedClientId);
  const selectedSpecialist = formData?.specialists?.find(s => s.id === selectedSpecialistId);

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

  // Load budgets for selected client
  const { data: budgets } = useQuery({
    queryKey: ['budgets-for-client-request', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data, error } = await supabase
        .from('budgets')
        .select('id, code, title')
        .eq('client_id', selectedClientId)
        .in('status', ['approved', 'invoiced'])
        .order('code', { ascending: false });
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
      // In create mode, apply default rates if not provided
      const finalSaleRate = isCreateMode && data.sale_type === 'hourly' && !data.sale_rate
        ? defaultRates?.saleRate ?? 0
        : data.sale_rate;
      const finalCostRate = isCreateMode && data.cost_type === 'hourly' && !data.cost_rate
        ? defaultRates?.costRate ?? 0
        : data.cost_rate;

      // Calculate sale_amount based on sale_type
      const sale_amount = data.sale_type === 'hourly'
        ? (data.sale_hours || 0) * (finalSaleRate || 0)
        : (data.unit_price || 0) * data.quantity;

      // Calculate cost_to_agency based on cost_type
      const cost_to_agency = data.cost_type === 'hourly'
        ? (data.hours || 0) * (finalCostRate || 0)
        : (data.fixed_cost || 0);

      const requestData = {
        client_id: data.client_id,
        service_id: data.service_id,
        specialist_id: data.specialist_id || null,
        contract_id: data.contract_id || null,
        budget_id: data.budget_id || null,
        client_contact_id: data.client_contact_id || null,
        title: data.title,
        description: data.description || null,
        quantity: data.quantity,
        deadline: data.deadline || null,
        status: data.status,
        // Sale fields
        sale_type: data.sale_type,
        unit_price: data.sale_type === 'fixed' ? data.unit_price : null,
        sale_rate: data.sale_type === 'hourly' ? finalSaleRate : null,
        sale_hours: data.sale_type === 'hourly' ? data.sale_hours : null,
        sale_amount,
        // Cost fields
        cost_type: data.cost_type,
        hours: data.cost_type === 'hourly' ? data.hours : null,
        cost_rate: data.cost_type === 'hourly' ? finalCostRate : null,
        fixed_cost: data.cost_type === 'fixed' ? data.fixed_cost : null,
        cost_to_agency,
        // Partner reference
        partner_reference: data.partner_reference || null,
      };

      if (initialData) {
        const { error } = await supabase
          .from('financial_requests')
          .update(requestData)
          .eq('id', initialData.id);
        if (error) throw error;
        
        // Sincronizar specialist en operational_request vinculado (si cambió)
        if (requestData.specialist_id !== initialData.specialist_id) {
          await supabase
            .from('operational_requests')
            .update({ assignee_specialist_id: requestData.specialist_id })
            .eq('financial_request_id', initialData.id);
        }
        
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

        // Fetch AM email from contract to send Slack DM
        let amEmail: string | null = null;
        if (data.contract_id) {
          const { data: contract } = await supabase
            .from('contracts')
            .select('am_user_id, profiles:am_user_id(email)')
            .eq('id', data.contract_id as string)
            .single();
          const profileEmail = (contract as any)?.profiles?.email;
          amEmail = profileEmail ?? null;
        }

        return { 
          isNew: true, 
          id: newRequest?.id,
          code: newRequest?.code,
          specialistData,
          status: data.status,
          clientId: data.client_id,
          title: data.title,
          deadline: data.deadline ?? null,
          amEmail,
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
        const specialistName = result.specialistData.name || 'Especialista';
        let hasInAppNotification = false;
        let hasEmailNotification = false;
        
        // In-app notification (if specialist has user_id)
        if (result.specialistData.user_id) {
          await notifySpecialistAssigned(
            result.specialistData.user_id,
            result.code || `Solicitud`,
            result.id,
            client?.name || 'Cliente'
          );
          hasInAppNotification = true;
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
                recipientName: specialistName,
                senderEmail,
                appUrl,
              },
            });
            hasEmailNotification = true;
          } catch (emailError) {
            console.error('Error sending email notification:', emailError);
          }
        }

        // Show notification feedback
        notificationFeedback.specialistAssigned(specialistName, hasEmailNotification, hasInAppNotification);
      }

      
      toast.success(
        initialData ? 'Solicitud actualizada' : 'Solicitud creada correctamente'
      );
      
      // Invalidar queries relacionadas (incluye operational_requests por sincronización)
      queryClient.invalidateQueries({ queryKey: ['operational-requests'] });
      queryClient.invalidateQueries({ queryKey: ['operational-project'] });
      
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
      if (initialData?.id) {
        queryClient.invalidateQueries({ queryKey: ['financial_request', initialData.id] });
        queryClient.invalidateQueries({ queryKey: ['financial-requests'] });
      }
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
          budget_id: initialData.budget_id ?? null,
          client_contact_id: contactToUse,
          title: initialData.title,
          description: initialData.description ?? null,
          quantity: toNum(initialData.quantity) ?? 1,
          deadline: initialData.deadline ?? null,
          status: initialData.status,
          // Sale fields
          sale_type: initialData.sale_type ?? 'fixed',
          unit_price: toNum(initialData.unit_price),
          sale_rate: toNum(initialData.sale_rate),
          sale_hours: toNum(initialData.sale_hours),
          // Cost fields
          cost_type: initialData.cost_type ?? 'fixed',
          hours: toNum(initialData.hours),
          cost_rate: toNum(initialData.cost_rate),
          fixed_cost: toNum(initialData.fixed_cost),
          // Partner reference
          partner_reference: initialData.partner_reference ?? null,
        });
      } else {
        form.reset({
          client_id: '',
          service_id: '',
          specialist_id: null,
          contract_id: null,
          budget_id: null,
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
          // Partner reference
          partner_reference: null,
        });
      }
    }
  }, [open, initialData, form]);

  // Clear contract, budget and contact when client changes
  useEffect(() => {
    if (selectedClientId) {
      // Check if current contract belongs to selected client
      const currentContractId = form.getValues('contract_id');
      if (currentContractId && contracts && !contracts.find(c => c.id === currentContractId)) {
        form.setValue('contract_id', null);
      }
      // Check if current budget belongs to selected client
      const currentBudgetId = form.getValues('budget_id');
      if (currentBudgetId && budgets && !budgets.find(b => b.id === currentBudgetId)) {
        form.setValue('budget_id', null);
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
                      onValueChange={(value) => {
                        field.onChange(value === 'none' ? null : value);
                        // Clear budget if contract is selected
                        if (value !== 'none') {
                          form.setValue('budget_id', null);
                        }
                      }}
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Origin: Budget selector */}
            <FormField
              control={form.control}
              name="budget_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Presupuesto</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value === 'none' ? null : value);
                      // Clear contract if budget is selected
                      if (value !== 'none') {
                        form.setValue('contract_id', null);
                      }
                    }}
                    value={field.value || 'none'}
                    disabled={isViewMode || !selectedClientId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin presupuesto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sin presupuesto</SelectItem>
                      {budgets?.map((budget) => (
                        <SelectItem key={budget.id} value={budget.id}>
                          {budget.code} — {budget.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Selecciona un contrato o un presupuesto como origen (obligatorio)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            {/* Partner Reference - show when a specialist is selected */}
            <FormField
              control={form.control}
              name="partner_reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referencia Partner</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: P1225-5602-4821"
                      {...field}
                      value={field.value || ''}
                      disabled={isViewMode}
                    />
                  </FormControl>
                  <FormDescription>
                    Código de proyecto del proveedor (para reconciliar facturas)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                            onChange={(e) => field.onChange(parseNum(e.target.value))}
                            disabled={isViewMode}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Show rate input only in edit mode */}
                  {!isCreateMode ? (
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
                              onChange={(e) => field.onChange(parseNum(e.target.value))}
                              disabled={isViewMode}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <div className="flex flex-col justify-center">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Info className="h-4 w-4" />
                        <span>
                          Se aplicará tarifa de{' '}
                          <span className="font-semibold text-foreground">
                            {effectiveSaleRate.toFixed(2)} €/h
                          </span>
                          {' '}{getRateSourceLabel(defaultRates?.saleRateSource || 'fallback', selectedClient?.name)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-2 text-sm text-muted-foreground">
                    Importe estimado: <span className="font-semibold text-foreground">{calculatedSaleAmount.toFixed(2)} €</span>
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
                            onChange={(e) => field.onChange(parseNum(e.target.value))}
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
                        placeholder="0"
                        value={field.value || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(parseNum(val) ?? 0);
                        }}
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
                          Horas del especialista
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={field.value !== null && field.value !== undefined ? field.value : ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              field.onChange(parseNum(val));
                            }}
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

                  {/* Show rate input only in edit mode */}
                  {!isCreateMode ? (
                    <FormField
                      control={form.control}
                      name="cost_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tarifa/Hora (€)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              name={field.name}
                              ref={field.ref}
                              onBlur={field.onBlur}
                              value={field.value !== null && field.value !== undefined ? field.value : ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(parseNum(val));
                              }}
                              disabled={isViewMode}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <div className="flex flex-col justify-center">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Info className="h-4 w-4" />
                        <span>
                          Se aplicará tarifa de{' '}
                          <span className="font-semibold text-foreground">
                            {effectiveCostRate.toFixed(2)} €/h
                          </span>
                          {' '}{getRateSourceLabel(defaultRates?.costRateSource || 'fallback', selectedSpecialist?.name)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-2 text-sm text-muted-foreground">
                    Coste estimado: <span className="font-semibold text-foreground">{calculatedCost.toFixed(2)} €</span>
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
                            onChange={(e) => field.onChange(parseNum(e.target.value))}
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
