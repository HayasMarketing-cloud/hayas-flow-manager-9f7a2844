import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileDown, Plus, Briefcase, FileText, MinusCircle } from 'lucide-react';
import { generateInvoicePDF } from '@/utils/pdf/invoicePDFGenerator';
import { InvoiceItemsEditor, type InvoiceItem } from '@/components/invoices/InvoiceItemsEditor';
import { InvoiceLinkedRequestsTable } from '@/components/invoices/InvoiceLinkedRequestsTable';
import { useRequestsForPeriod } from '@/hooks/useRequestsForPeriod';
import { useContractsForInvoice } from '@/hooks/useContractsForInvoice';
import { BudgetAllocationEditor } from '@/components/invoices/BudgetAllocationEditor';
import { 
  useInvoiceAllocations, 
  useAvailableBudgetsWithAllocations,
  useSaveInvoiceAllocations,
  BudgetAllocation 
} from '@/hooks/useInvoiceBudgetAllocations';

const invoiceSchema = z.object({
  code: z.string().optional(),
  client_id: z.string().min(1, 'El cliente es obligatorio'),
  invoice_date: z.string().min(1, 'La fecha es obligatoria'),
  due_date: z.string().optional(),
  tax_rate: z.number().min(0).max(100),
  notes: z.string().optional(),
  period_month: z.number().min(1).max(12).optional(),
  period_year: z.number().min(2000).max(2100).optional(),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;
type AssociationType = 'budgets' | 'contract' | 'none';

interface InvoiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice?: any;
  mode: 'create' | 'edit' | 'view';
}

const months = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export function InvoiceFormModal({ isOpen, onClose, invoice, mode }: InvoiceFormModalProps) {
  const queryClient = useQueryClient();
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [aggregatedDescription, setAggregatedDescription] = useState('');
  const [pricePerHour, setPricePerHour] = useState<number>(0);
  const [manualSubtotal, setManualSubtotal] = useState<number>(0);
  const [editedTaxRate, setEditedTaxRate] = useState<number>(21);

  // Association state
  const [associationType, setAssociationType] = useState<AssociationType>('none');
  const [budgetAllocations, setBudgetAllocations] = useState<BudgetAllocation[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [billingMonth, setBillingMonth] = useState<number | null>(null);
  const [billingYear, setBillingYear] = useState<number | null>(null);
  // Tracks if the user manually edited billing period — disables auto-suggestion
  const [billingPeriodDirty, setBillingPeriodDirty] = useState(false);

  // Flag to prevent re-initialization from async data changes (race condition fix)
  const [hasInitializedAssociations, setHasInitializedAssociations] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      tax_rate: 21,
      invoice_date: new Date().toISOString().split('T')[0],
    },
  });

  const clientId = watch('client_id');
  const invoiceDateWatch = watch('invoice_date');
  const periodMonth = watch('period_month');
  const periodYear = watch('period_year');

  // Auto-suggest billing period from invoice_date - 1 month (unless user has edited it)
  useEffect(() => {
    if (billingPeriodDirty) return;
    if (!invoiceDateWatch) return;
    const d = new Date(invoiceDateWatch);
    if (isNaN(d.getTime())) return;
    d.setMonth(d.getMonth() - 1);
    setBillingMonth(d.getMonth() + 1);
    setBillingYear(d.getFullYear());
  }, [invoiceDateWatch, billingPeriodDirty]);

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ['clients-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('name');
      return data || [];
    },
  });

  // Fetch budgets with allocation info and contracts for association
  const { data: availableBudgets = [] } = useAvailableBudgetsWithAllocations(clientId, invoice?.id);
  const { data: availableContracts = [] } = useContractsForInvoice(clientId);
  const { data: existingAllocations = [] } = useInvoiceAllocations(invoice?.id);
  const saveAllocationsMutation = useSaveInvoiceAllocations();

  // Fetch requests for period (for line items creation)
  const { data: availableRequests = [] } = useRequestsForPeriod(
    clientId,
    periodMonth,
    periodYear
  );

  // Calculate totals - use items sum if available, otherwise manual subtotal
  const itemsSubtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
  const subtotal = itemsSubtotal > 0 ? itemsSubtotal : manualSubtotal;
  const taxRate = editedTaxRate;
  const taxAmount = (subtotal * taxRate) / 100;
  const totalAmount = subtotal + taxAmount;

  // Calculate total hours from selected requests
  const totalHours = availableRequests
    .filter((r) => selectedRequestIds.includes(r.id))
    .reduce((sum, r) => sum + (r.hours || 0), 0);

  // Reset initialization flag when invoice changes
  useEffect(() => {
    setHasInitializedAssociations(false);
  }, [invoice?.id]);

  // Effect 1: Initialize form data (synchronous from invoice)
  useEffect(() => {
    if (invoice && mode !== 'create') {
      reset({
        code: invoice.code || '',
        client_id: invoice.client_id,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date || '',
        tax_rate: invoice.tax_rate,
        notes: invoice.notes || '',
      });
      // Load manual subtotal and tax rate from invoice for imported invoices
      setManualSubtotal(invoice.subtotal || 0);
      setEditedTaxRate(invoice.tax_rate ?? 21);
    } else if (mode === 'create') {
      reset({
        tax_rate: 21,
        invoice_date: new Date().toISOString().split('T')[0],
      });
      setInvoiceItems([]);
      setSelectedRequestIds([]);
      setManualSubtotal(0);
      setEditedTaxRate(21);
      setAssociationType('none');
      setBudgetAllocations([]);
      setSelectedContractId(null);
      setBillingMonth(null);
      setBillingYear(null);
      setHasInitializedAssociations(true); // Mark as initialized for create mode
    }
  }, [invoice, mode, reset]);

  // Effect 2: Initialize associations (depends on async data, runs only ONCE per invoice)
  useEffect(() => {
    // Only initialize once when we have the required data
    if (invoice && mode !== 'create' && !hasInitializedAssociations && 
        existingAllocations !== undefined && availableBudgets !== undefined) {
      
      console.log('[InvoiceFormModal] Initializing associations for invoice:', invoice.id, {
        existingAllocations: existingAllocations.length,
        hasLegacyBudgetId: !!invoice.budget_id,
        hasContractId: !!invoice.contract_id,
      });

      // Always load billing period from invoice (independent of association type)
      if (invoice.billing_period_month && invoice.billing_period_year) {
        setBillingMonth(invoice.billing_period_month);
        setBillingYear(invoice.billing_period_year);
        setBillingPeriodDirty(true); // existing value — don't auto-overwrite
      }

      // Load association data - check for allocations first, then legacy budget_id
      if (existingAllocations.length > 0) {
        setAssociationType('budgets');
        setBudgetAllocations(existingAllocations);
        setSelectedContractId(null);
      } else if (invoice.budget_id) {
        // Legacy single budget - convert to allocation format
        const budget = availableBudgets.find(b => b.id === invoice.budget_id);
        if (budget) {
          setAssociationType('budgets');
          setBudgetAllocations([{
            budget_id: budget.id,
            budget_code: budget.code,
            budget_title: budget.title,
            budget_total: budget.total_amount,
            allocated_amount: invoice.total_amount || 0,
            budget_invoiced_amount: budget.invoiced_amount,
            budget_remaining: budget.remaining_amount,
          }]);
        }
        setSelectedContractId(null);
      } else if (invoice.contract_id) {
        setAssociationType('contract');
        setSelectedContractId(invoice.contract_id);
        setBudgetAllocations([]);
      } else {
        setAssociationType('none');
        setBudgetAllocations([]);
        setSelectedContractId(null);
      }

      // Mark as initialized to prevent re-runs from async data changes
      setHasInitializedAssociations(true);
    }
  }, [invoice, mode, existingAllocations, availableBudgets, hasInitializedAssociations]);

  // Load existing invoice items when editing
  useEffect(() => {
    if (invoice && mode === 'edit') {
      const loadInvoiceItems = async () => {
        const { data: items } = await supabase
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', invoice.id);

        if (items) {
          const formattedItems: InvoiceItem[] = items.map((item) => ({
            id: item.id,
            type: item.aggregated_request_ids ? 'aggregated' : 'manual',
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
            request_ids: item.aggregated_request_ids || undefined,
          }));
          setInvoiceItems(formattedItems);
        }
      };
      loadInvoiceItems();
    }
  }, [invoice, mode]);

  const createMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      // Generate code
      const { data: codeData } = await supabase.rpc('generate_code', {
        sequence_name: 'invoices',
      });

      // Prepare association fields - now using allocations table for budgets
      const contractId = associationType === 'contract' ? selectedContractId : null;
      const periodMonthValue = associationType === 'contract' ? billingMonth : null;
      const periodYearValue = associationType === 'contract' ? billingYear : null;

      // Create invoice (without budget_id - we'll use allocations table)
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          code: codeData,
          client_id: data.client_id,
          invoice_date: data.invoice_date,
          due_date: data.due_date || null,
          tax_rate: data.tax_rate,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          notes: data.notes || null,
          status: 'draft',
          budget_id: null, // Legacy field - keeping null, using allocations instead
          contract_id: contractId,
          billing_period_month: periodMonthValue,
          billing_period_year: periodYearValue,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Save budget allocations if any
      if (associationType === 'budgets' && budgetAllocations.length > 0) {
        await saveAllocationsMutation.mutateAsync({
          invoiceId: newInvoice.id,
          allocations: budgetAllocations,
        });
      }

      // Create invoice items
      for (const item of invoiceItems) {
        const { error: itemError } = await supabase.from('invoice_items').insert({
          invoice_id: newInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          aggregated_request_ids: item.request_ids || null,
        });

        if (itemError) throw itemError;

        // Mark requests as invoiced if aggregated
        if (item.request_ids && item.request_ids.length > 0) {
          const { error: requestError } = await supabase
            .from('financial_requests')
            .update({
              billed_invoice_id: newInvoice.id,
            })
            .in('id', item.request_ids);

          if (requestError) throw requestError;
        }
      }

      return newInvoice;
    },
    onSuccess: () => {
      toast.success('Factura creada correctamente');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['requests-for-period'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budgets-for-invoice'] });
      onClose();
    },
    onError: (error) => {
      console.error('Error creating invoice:', error);
      toast.error('Error al crear la factura');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      // Prepare association fields
      const contractId = associationType === 'contract' ? selectedContractId : null;
      const periodMonthValue = associationType === 'contract' ? billingMonth : null;
      const periodYearValue = associationType === 'contract' ? billingYear : null;

      // Update invoice
      const updateData: any = {
        client_id: data.client_id,
        invoice_date: data.invoice_date,
        due_date: data.due_date || null,
        tax_rate: data.tax_rate,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: data.notes || null,
        budget_id: null, // Legacy field - keeping null, using allocations instead
        contract_id: contractId,
        billing_period_month: periodMonthValue,
        billing_period_year: periodYearValue,
      };

      // Allow code update if provided
      if (data.code && data.code.trim()) {
        updateData.code = data.code.trim();
      }

      const { error: invoiceError } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      // Save budget allocations
      if (associationType === 'budgets') {
        await saveAllocationsMutation.mutateAsync({
          invoiceId: invoice.id,
          allocations: budgetAllocations,
        });
      } else {
        // Clear allocations if not using budgets
        await saveAllocationsMutation.mutateAsync({
          invoiceId: invoice.id,
          allocations: [],
        });
      }

      // Delete old items
      await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);

      // Create new items
      for (const item of invoiceItems) {
        const { error: itemError } = await supabase.from('invoice_items').insert({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          aggregated_request_ids: item.request_ids || null,
        });

        if (itemError) throw itemError;

        // Mark requests as invoiced if aggregated
        if (item.request_ids && item.request_ids.length > 0) {
          await supabase
            .from('financial_requests')
            .update({
              billed_invoice_id: invoice.id,
            })
            .in('id', item.request_ids);
        }
      }
    },
    onSuccess: () => {
      toast.success('Factura actualizada correctamente');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['requests-for-period'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budgets-for-invoice'] });
      onClose();
    },
    onError: (error) => {
      console.error('Error updating invoice:', error);
      toast.error('Error al actualizar la factura');
    },
  });

  const handleDownloadPDF = async () => {
    if (!invoice) return;

    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id);

    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', invoice.client_id)
      .single();

    if (items && client) {
      await generateInvoicePDF({
        invoice,
        items,
        client,
      });
    }
  };

  const handleAddAggregatedRequests = () => {
    if (selectedRequestIds.length === 0) {
      toast.error('Selecciona al menos un request');
      return;
    }

    if (!aggregatedDescription.trim()) {
      toast.error('Añade una descripción para la línea agregada');
      return;
    }

    if (pricePerHour <= 0) {
      toast.error('El precio por hora debe ser mayor a 0');
      return;
    }

    const newItem: InvoiceItem = {
      type: 'aggregated',
      description: aggregatedDescription,
      quantity: totalHours,
      unit_price: pricePerHour,
      total: totalHours * pricePerHour,
      request_ids: selectedRequestIds,
    };

    setInvoiceItems([...invoiceItems, newItem]);
    setSelectedRequestIds([]);
    setAggregatedDescription('');
    setPricePerHour(0);
    toast.success('Requests agregadas como línea de factura');
  };

  const handleSelectAllRequests = (checked: boolean) => {
    if (checked) {
      setSelectedRequestIds(availableRequests.map((r) => r.id));
    } else {
      setSelectedRequestIds([]);
    }
  };

  const onSubmit = (data: InvoiceFormData) => {
    // Debug log to verify state at submission time
    console.log('[InvoiceFormModal] onSubmit called', {
      associationType,
      budgetAllocationsCount: budgetAllocations.length,
      budgetAllocations: budgetAllocations.map(a => ({ budget_id: a.budget_id, amount: a.allocated_amount })),
    });

    // For new invoices require items, for edit allow manual subtotal (imported invoices)
    if (mode === 'create' && invoiceItems.length === 0) {
      toast.error('Añade al menos una línea a la factura');
      return;
    }

    // For edit mode without items, require manual subtotal > 0
    if (mode === 'edit' && invoiceItems.length === 0 && manualSubtotal <= 0) {
      toast.error('El subtotal debe ser mayor a 0');
      return;
    }

    // Validate budget association requires at least one allocation
    if (associationType === 'budgets' && budgetAllocations.length === 0) {
      toast.error('Añade al menos una asignación de presupuesto o selecciona "Sin asociar"');
      return;
    }

    // Validate contract association requires period
    if (associationType === 'contract' && selectedContractId && (!billingMonth || !billingYear)) {
      toast.error('Selecciona el mes y año de facturación para el contrato');
      return;
    }

    if (mode === 'create') {
      createMutation.mutate(data);
    } else if (mode === 'edit') {
      updateMutation.mutate(data);
    }
  };

  // Allow editing in edit mode regardless of status (for imported invoices)
  const disabled = mode === 'view';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' && 'Nueva Factura'}
            {mode === 'edit' && 'Editar Factura'}
            {mode === 'view' && `Factura ${invoice?.code}`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            {/* Code field - editable in edit mode */}
            {mode !== 'create' && (
              <div className="space-y-2">
                <Label>Código de Factura</Label>
                <Input
                  {...register('code')}
                  disabled={disabled}
                  placeholder="FAC-2024-001"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select
                value={watch('client_id')}
                onValueChange={(value) => {
                  setValue('client_id', value);
                  // Reset associations when client changes
                  setAssociationType('none');
                  setBudgetAllocations([]);
                  setSelectedContractId(null);
                }}
                disabled={disabled}
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
              {errors.client_id && (
                <p className="text-sm text-destructive">{errors.client_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Fecha de Factura *</Label>
              <Input type="date" {...register('invoice_date')} disabled={disabled} />
              {errors.invoice_date && (
                <p className="text-sm text-destructive">{errors.invoice_date.message}</p>
              )}
            </div>
          </div>

          {/* Association Selector */}
          {clientId && (
            <Card className="p-4 space-y-4">
              <h3 className="font-medium">Asociar factura a:</h3>
              <RadioGroup
                value={associationType}
                onValueChange={(value: AssociationType) => {
                  setAssociationType(value);
                  if (value !== 'budgets') setBudgetAllocations([]);
                  if (value !== 'contract') {
                    setSelectedContractId(null);
                    setBillingMonth(null);
                    setBillingYear(null);
                  }
                }}
                disabled={disabled}
                className="space-y-3"
              >
                {/* Budget Option - now with multi-allocation */}
                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="budgets" id="budgets" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="budgets" className="flex items-center gap-2 cursor-pointer font-medium">
                      <FileText className="h-4 w-4 text-purple-600" />
                      Presupuesto(s)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Permite asociar múltiples presupuestos con importes específicos
                    </p>
                  </div>
                </div>

                {/* Contract Option */}
                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="contract" id="contract" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="contract" className="flex items-center gap-2 cursor-pointer font-medium">
                      <Briefcase className="h-4 w-4 text-blue-600" />
                      Contrato + Período
                    </Label>
                    {associationType === 'contract' && (
                      <div className="space-y-3">
                        <Select
                          value={selectedContractId || ''}
                          onValueChange={setSelectedContractId}
                          disabled={disabled}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccionar contrato" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableContracts.length === 0 ? (
                              <SelectItem value="_none" disabled>
                                No hay contratos activos
                              </SelectItem>
                            ) : (
                              availableContracts.map((contract) => (
                                <SelectItem key={contract.id} value={contract.id}>
                                  {contract.code} - {contract.title}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {selectedContractId && (
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={billingMonth?.toString() || ''}
                              onValueChange={(v) => setBillingMonth(parseInt(v))}
                              disabled={disabled}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Mes" />
                              </SelectTrigger>
                              <SelectContent>
                                {months.map((m) => (
                                  <SelectItem key={m.value} value={m.value.toString()}>
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={billingYear?.toString() || ''}
                              onValueChange={(v) => setBillingYear(parseInt(v))}
                              disabled={disabled}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Año" />
                              </SelectTrigger>
                              <SelectContent>
                                {years.map((y) => (
                                  <SelectItem key={y} value={y.toString()}>
                                    {y}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* None Option */}
                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="none" id="none" className="mt-1" />
                  <Label htmlFor="none" className="flex items-center gap-2 cursor-pointer font-medium">
                    <MinusCircle className="h-4 w-4 text-muted-foreground" />
                    Sin asociar (facturas históricas)
                  </Label>
                </div>
              </RadioGroup>
            </Card>
          )}

          {/* Budget Allocation Editor - shown when budgets association is selected */}
          {clientId && associationType === 'budgets' && (
            <BudgetAllocationEditor
              invoiceTotal={totalAmount}
              allocations={budgetAllocations}
              availableBudgets={availableBudgets}
              onAllocationsChange={setBudgetAllocations}
              disabled={disabled}
            />
          )}
          {mode === 'create' && (
            <Card className="p-4 space-y-3">
              <h3 className="font-medium">Período para buscar solicitudes</h3>
              <p className="text-sm text-muted-foreground">
                Selecciona un período para cargar las solicitudes completadas y crear líneas de factura
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mes</Label>
                  <Select
                    value={periodMonth?.toString()}
                    onValueChange={(value) => setValue('period_month', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar mes" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month) => (
                        <SelectItem key={month.value} value={month.value.toString()}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Año</Label>
                  <Select
                    value={periodYear?.toString()}
                    onValueChange={(value) => setValue('period_year', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar año" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          )}

          <Separator />

          {/* Invoice Items */}
          <div className="space-y-3">
            <h3 className="font-medium">Líneas de factura</h3>
            <InvoiceItemsEditor
              items={invoiceItems}
              onChange={setInvoiceItems}
              disabled={disabled}
            />

            {/* Manual subtotal input for imported invoices without items */}
            {invoiceItems.length === 0 && mode !== 'create' && (
              <Card className="p-4 space-y-2 border-dashed">
                <Label>Subtotal (sin líneas de factura)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualSubtotal || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setManualSubtotal(val === '' ? 0 : parseFloat(val) || 0);
                  }}
                  disabled={disabled}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Para facturas importadas sin líneas detalladas, ingresa el subtotal directamente.
                </p>
              </Card>
            )}
          </div>

          {/* Available Requests */}
          {mode === 'create' && clientId && periodMonth && periodYear && (
            <>
              <Separator />
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    Requests disponibles ({availableRequests.length} requests, {totalHours.toFixed(2)}h
                    seleccionadas)
                  </h3>
                  <Checkbox
                    checked={
                      availableRequests.length > 0 &&
                      selectedRequestIds.length === availableRequests.length
                    }
                    onCheckedChange={handleSelectAllRequests}
                  />
                </div>

                {availableRequests.length > 0 ? (
                  <>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {availableRequests.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedRequestIds.includes(request.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedRequestIds([...selectedRequestIds, request.id]);
                                } else {
                                  setSelectedRequestIds(
                                    selectedRequestIds.filter((id) => id !== request.id)
                                  );
                                }
                              }}
                            />
                            <div>
                              <p className="text-sm font-medium">{request.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {request.service?.name} • {request.hours}h
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedRequestIds.length > 0 && (
                      <div className="space-y-3 pt-3 border-t">
                        <div className="space-y-2">
                          <Label>Descripción para la línea agregada</Label>
                          <Textarea
                            value={aggregatedDescription}
                            onChange={(e) => setAggregatedDescription(e.target.value)}
                            placeholder="Ej: Creación de formularios, revisiones y ajustes - Noviembre 2024"
                            rows={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Precio por hora (€)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0"
                            value={pricePerHour || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPricePerHour(val === '' ? 0 : parseFloat(val) || 0);
                            }}
                          />
                        </div>
                        <Button type="button" onClick={handleAddAggregatedRequests}>
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar {selectedRequestIds.length} requests como línea (
                          {totalHours.toFixed(2)}h × {pricePerHour}€ ={' '}
                          {(totalHours * pricePerHour).toFixed(2)}€)
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay requests pendientes de facturar en este período
                  </p>
                )}
              </Card>
            </>
          )}

          <Separator />

          {/* Additional Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de Facturación</Label>
              <Input type="date" {...register('due_date')} disabled={disabled} />
            </div>

            <div className="space-y-2">
              <Label>IVA (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={editedTaxRate}
                onChange={(e) => {
                  const val = e.target.value;
                  const newRate = val === '' ? 0 : parseFloat(val) || 0;
                  setEditedTaxRate(newRate);
                  setValue('tax_rate', newRate);
                }}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea {...register('notes')} disabled={disabled} rows={3} />
          </div>

          {/* Linked Requests - only in view mode */}
          {mode === 'view' && invoice && (
            <InvoiceLinkedRequestsTable invoiceId={invoice.id} />
          )}

          {/* Summary */}
          <Card className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span className="font-medium">
                {subtotal.toLocaleString('es-ES', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>IVA ({taxRate}%):</span>
              <span className="font-medium">
                {taxAmount.toLocaleString('es-ES', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>TOTAL:</span>
              <span>
                {totalAmount.toLocaleString('es-ES', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </span>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              {mode === 'view' ? 'Cerrar' : 'Cancelar'}
            </Button>
            {mode === 'view' && (
              <Button type="button" onClick={handleDownloadPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
            )}
            {!disabled && (
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {mode === 'create' ? 'Crear Factura' : 'Guardar Cambios'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
