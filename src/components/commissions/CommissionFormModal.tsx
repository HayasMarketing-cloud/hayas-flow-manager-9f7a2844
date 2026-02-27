import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, FileText, Calculator } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type CommissionType = 'sales' | 'am' | 'pm';

interface Commission {
  id: string;
  commission_type?: CommissionType;
  seller_user_id: string;
  contract_id: string | null;
  budget_id: string | null;
  invoice_ids?: string[];
  commission_percentage: number;
  commission_amount: number;
  base_amount: number;
  status: string;
  paid_at: string | null;
  notes: string | null;
}

interface Invoice {
  id: string;
  code: string;
  subtotal: number;
  invoice_date: string;
  client: { name: string } | null;
}

interface CommissionFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commission: Commission | null;
  mode: 'create' | 'edit' | 'view';
  onSuccess: () => void;
}

const commissionTypeLabels: Record<CommissionType, string> = {
  sales: 'Venta',
  am: 'Account Manager (AM)',
  pm: 'Project Manager (PM)',
};

export function CommissionFormModal({
  open,
  onOpenChange,
  commission,
  mode,
  onSuccess,
}: CommissionFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isViewMode = mode === 'view';

  const [formData, setFormData] = useState({
    commission_type: 'am' as CommissionType,
    seller_user_id: '',
    source_type: 'budget' as 'contract' | 'budget',
    contract_id: '',
    budget_id: '',
    invoice_ids: [] as string[],
    commission_percentage: 5,
    base_amount: 0,
    commission_amount: 0,
    status: 'pending',
    notes: '',
  });

  // Fetch default commission percentages
  const { data: commissionSettings } = useQuery({
    queryKey: ['commission-settings'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('commission_settings' as any)
        .select('commission_type, default_percentage') as any);
      if (error) throw error;
      return data as { commission_type: string; default_percentage: number }[];
    },
    enabled: open,
  });

  // Fetch users (profiles)
  const { data: users } = useQuery({
    queryKey: ['profiles-for-commission'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch contracts
  const { data: contracts } = useQuery({
    queryKey: ['contracts-for-commission'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, title, code, total_amount, client:clients(name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && formData.source_type === 'contract',
  });

  // Fetch budgets
  const { data: budgets } = useQuery({
    queryKey: ['budgets-for-commission'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('id, title, code, total_amount, client:clients(name), am_user_id, pm_user_id')
        .in('status', ['approved', 'invoiced'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch invoices for the selected budget/contract
  const { data: availableInvoices } = useQuery({
    queryKey: ['invoices-for-commission', formData.budget_id, formData.contract_id],
    queryFn: async () => {
      // Get client_id from budget or contract
      let clientId: string | null = null;
      
      if (formData.budget_id) {
        const budget = budgets?.find(b => b.id === formData.budget_id);
        if (budget) {
          const { data: budgetData } = await supabase
            .from('budgets')
            .select('client_id')
            .eq('id', formData.budget_id)
            .single();
          clientId = budgetData?.client_id || null;
        }
      } else if (formData.contract_id) {
        const contract = contracts?.find(c => c.id === formData.contract_id);
        if (contract) {
          const { data: contractData } = await supabase
            .from('contracts')
            .select('client_id')
            .eq('id', formData.contract_id)
            .single();
          clientId = contractData?.client_id || null;
        }
      }
      
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('invoices')
        .select('id, code, subtotal, invoice_date, client:clients(name)')
        .eq('client_id', clientId)
        .order('invoice_date', { ascending: false });
      
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: open && (!!formData.budget_id || !!formData.contract_id),
  });

  // Set default percentage when commission type changes
  useEffect(() => {
    if (commissionSettings && mode === 'create') {
      const setting = commissionSettings.find(s => s.commission_type === formData.commission_type);
      if (setting) {
        setFormData(prev => ({ ...prev, commission_percentage: Number(setting.default_percentage) }));
      }
    }
  }, [formData.commission_type, commissionSettings, mode]);

  // Auto-suggest AM/PM user when selecting budget
  useEffect(() => {
    if (mode === 'create' && formData.budget_id && budgets) {
      const budget = budgets.find(b => b.id === formData.budget_id);
      if (budget) {
        if (formData.commission_type === 'am' && budget.am_user_id) {
          setFormData(prev => ({ ...prev, seller_user_id: budget.am_user_id! }));
        } else if (formData.commission_type === 'pm' && budget.pm_user_id) {
          setFormData(prev => ({ ...prev, seller_user_id: budget.pm_user_id! }));
        }
      }
    }
  }, [formData.budget_id, formData.commission_type, budgets, mode]);

  useEffect(() => {
    if (commission && mode !== 'create') {
      setFormData({
        commission_type: (commission.commission_type as CommissionType) || 'am',
        seller_user_id: commission.seller_user_id,
        source_type: commission.contract_id ? 'contract' : 'budget',
        contract_id: commission.contract_id || '',
        budget_id: commission.budget_id || '',
        invoice_ids: commission.invoice_ids || [],
        commission_percentage: commission.commission_percentage,
        base_amount: commission.base_amount,
        commission_amount: commission.commission_amount,
        status: commission.status,
        notes: commission.notes || '',
      });
    } else {
      const defaultPercentage = commissionSettings?.find(s => s.commission_type === 'am')?.default_percentage || 5;
      setFormData({
        commission_type: 'am',
        seller_user_id: '',
        source_type: 'budget',
        contract_id: '',
        budget_id: '',
        invoice_ids: [],
        commission_percentage: Number(defaultPercentage),
        base_amount: 0,
        commission_amount: 0,
        status: 'pending',
        notes: '',
      });
    }
  }, [commission, mode, open, commissionSettings]);

  // Auto-calculate commission when percentage or base changes
  useEffect(() => {
    const amount = (formData.base_amount * formData.commission_percentage) / 100;
    setFormData(prev => ({ ...prev, commission_amount: Math.round(amount * 100) / 100 }));
  }, [formData.base_amount, formData.commission_percentage]);

  // Calculate base amount from selected invoices
  useEffect(() => {
    if (formData.invoice_ids.length > 0 && availableInvoices) {
      const selectedInvoices = availableInvoices.filter(inv => formData.invoice_ids.includes(inv.id));
      const total = selectedInvoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0);
      setFormData(prev => ({ ...prev, base_amount: total }));
    }
  }, [formData.invoice_ids, availableInvoices]);

  const toggleInvoice = (invoiceId: string) => {
    setFormData(prev => ({
      ...prev,
      invoice_ids: prev.invoice_ids.includes(invoiceId)
        ? prev.invoice_ids.filter(id => id !== invoiceId)
        : [...prev.invoice_ids, invoiceId],
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        commission_type: formData.commission_type,
        seller_user_id: formData.seller_user_id,
        contract_id: formData.source_type === 'contract' ? formData.contract_id : null,
        budget_id: formData.source_type === 'budget' ? formData.budget_id : null,
        invoice_ids: formData.invoice_ids,
        commission_percentage: formData.commission_percentage,
        base_amount: formData.base_amount,
        commission_amount: formData.commission_amount,
        status: formData.status,
        notes: formData.notes || null,
        paid_at: formData.status === 'paid' ? new Date().toISOString() : null,
      };

      if (mode === 'edit' && commission) {
        const { error } = await (supabase
          .from('sales_commissions' as any)
          .update(payload)
          .eq('id', commission.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from('sales_commissions' as any)
          .insert(payload) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-commissions'] });
      toast({
        title: mode === 'edit' ? 'Comisión actualizada' : 'Comisión creada',
        description: 'La comisión se ha guardado correctamente',
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.seller_user_id) {
      toast({ title: 'Error', description: 'Selecciona un beneficiario', variant: 'destructive' });
      return;
    }
    if (formData.source_type === 'contract' && !formData.contract_id) {
      toast({ title: 'Error', description: 'Selecciona un contrato', variant: 'destructive' });
      return;
    }
    if (formData.source_type === 'budget' && !formData.budget_id) {
      toast({ title: 'Error', description: 'Selecciona un presupuesto', variant: 'destructive' });
      return;
    }
    if (formData.base_amount <= 0) {
      toast({ title: 'Error', description: 'El importe base debe ser mayor a 0', variant: 'destructive' });
      return;
    }
    saveMutation.mutate();
  };

  const selectedInvoicesSubtotal = availableInvoices
    ?.filter(inv => formData.invoice_ids.includes(inv.id))
    .reduce((sum, inv) => sum + Number(inv.subtotal), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Nueva Comisión' : mode === 'edit' ? 'Editar Comisión' : 'Ver Comisión'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Crea una nueva comisión basada en facturas emitidas' 
              : mode === 'edit' 
                ? 'Modifica los datos de la comisión'
                : 'Detalles de la comisión'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de comisión *</Label>
              <Select
                value={formData.commission_type}
                onValueChange={(v) => setFormData(prev => ({ ...prev, commission_type: v as CommissionType }))}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(commissionTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Beneficiario *</Label>
              <Select
                value={formData.seller_user_id}
                onValueChange={(v) => setFormData(prev => ({ ...prev, seller_user_id: v }))}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar beneficiario" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Origen</Label>
              <Select
                value={formData.source_type}
                onValueChange={(v) => setFormData(prev => ({ 
                  ...prev, 
                  source_type: v as 'contract' | 'budget',
                  contract_id: '',
                  budget_id: '',
                  invoice_ids: [],
                  base_amount: 0,
                }))}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">Presupuesto</SelectItem>
                  <SelectItem value="contract">Contrato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{formData.source_type === 'contract' ? 'Contrato' : 'Presupuesto'} *</Label>
              {formData.source_type === 'contract' ? (
                <Select
                  value={formData.contract_id}
                  onValueChange={(v) => setFormData(prev => ({ 
                    ...prev, 
                    contract_id: v, 
                    invoice_ids: [],
                    base_amount: 0,
                  }))}
                  disabled={isViewMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts?.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {contract.code} - {contract.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={formData.budget_id}
                  onValueChange={(v) => setFormData(prev => ({ 
                    ...prev, 
                    budget_id: v,
                    invoice_ids: [],
                    base_amount: 0,
                  }))}
                  disabled={isViewMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar presupuesto" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgets?.map((budget) => (
                      <SelectItem key={budget.id} value={budget.id}>
                        {budget.code} - {budget.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Invoice selector */}
          {(formData.budget_id || formData.contract_id) && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Facturas base para el cálculo
              </Label>
              {availableInvoices && availableInvoices.length > 0 ? (
                <>
                  <ScrollArea className="h-40 rounded-md border p-3">
                    <div className="space-y-2">
                      {availableInvoices.map((invoice) => (
                        <div 
                          key={invoice.id} 
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
                        >
                          <Checkbox
                            id={invoice.id}
                            checked={formData.invoice_ids.includes(invoice.id)}
                            onCheckedChange={() => toggleInvoice(invoice.id)}
                            disabled={isViewMode}
                          />
                          <label 
                            htmlFor={invoice.id} 
                            className="flex-1 cursor-pointer text-sm flex justify-between items-center"
                          >
                            <span>
                              <span className="font-medium">{invoice.code}</span>
                              <span className="text-muted-foreground ml-2">
                                ({format(new Date(invoice.invoice_date), "d MMM yyyy", { locale: es })})
                              </span>
                            </span>
                            <span className="font-medium">
                              {Number(invoice.subtotal).toLocaleString('es-ES', {
                                style: 'currency',
                                currency: 'EUR',
                              })}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  {formData.invoice_ids.length > 0 && (
                    <div className="text-sm text-right text-muted-foreground">
                      Subtotal facturas seleccionadas:{' '}
                      <span className="font-medium text-foreground">
                        {selectedInvoicesSubtotal.toLocaleString('es-ES', {
                          style: 'currency',
                          currency: 'EUR',
                        })}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground p-4 border rounded-md text-center">
                  No hay facturas disponibles para este {formData.source_type === 'contract' ? 'contrato' : 'presupuesto'}
                </div>
              )}
            </div>
          )}

          <div className="p-4 bg-muted/50 rounded-lg space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calculator className="h-4 w-4" />
              Cálculo de comisión
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Importe Base (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={formData.base_amount || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, base_amount: val === '' ? 0 : parseFloat(val) || 0 }));
                  }}
                  disabled={isViewMode}
                />
                <p className="text-xs text-muted-foreground">Editable si difiere de facturas</p>
              </div>
              <div className="space-y-2">
                <Label>Porcentaje (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={formData.commission_percentage || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, commission_percentage: val === '' ? 0 : parseFloat(val) || 0 }));
                  }}
                  disabled={isViewMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Comisión Calculada (€)</Label>
                <Input
                  type="number"
                  value={formData.commission_amount.toFixed(2)}
                  readOnly
                  className="bg-background font-medium text-primary"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="approved">Aprobada</SelectItem>
                  <SelectItem value="paid">Pagada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Notas adicionales..."
              disabled={isViewMode}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-background pb-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isViewMode ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!isViewMode && (
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
