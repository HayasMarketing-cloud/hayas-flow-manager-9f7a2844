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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

interface Commission {
  id: string;
  seller_user_id: string;
  contract_id: string | null;
  budget_id: string | null;
  commission_percentage: number;
  commission_amount: number;
  base_amount: number;
  status: string;
  paid_at: string | null;
  notes: string | null;
}

interface CommissionFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commission: Commission | null;
  mode: 'create' | 'edit' | 'view';
  onSuccess: () => void;
}

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
    seller_user_id: '',
    source_type: 'contract' as 'contract' | 'budget',
    contract_id: '',
    budget_id: '',
    commission_percentage: 0,
    base_amount: 0,
    commission_amount: 0,
    status: 'pending',
    notes: '',
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
        .select('id, title, code, total_amount, client:clients(name)')
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && formData.source_type === 'budget',
  });

  useEffect(() => {
    if (commission && mode !== 'create') {
      setFormData({
        seller_user_id: commission.seller_user_id,
        source_type: commission.contract_id ? 'contract' : 'budget',
        contract_id: commission.contract_id || '',
        budget_id: commission.budget_id || '',
        commission_percentage: commission.commission_percentage,
        base_amount: commission.base_amount,
        commission_amount: commission.commission_amount,
        status: commission.status,
        notes: commission.notes || '',
      });
    } else {
      setFormData({
        seller_user_id: '',
        source_type: 'contract',
        contract_id: '',
        budget_id: '',
        commission_percentage: 0,
        base_amount: 0,
        commission_amount: 0,
        status: 'pending',
        notes: '',
      });
    }
  }, [commission, mode, open]);

  // Auto-calculate commission when percentage or base changes
  useEffect(() => {
    const amount = (formData.base_amount * formData.commission_percentage) / 100;
    setFormData(prev => ({ ...prev, commission_amount: Math.round(amount * 100) / 100 }));
  }, [formData.base_amount, formData.commission_percentage]);

  // Auto-fill base amount when selecting contract/budget
  useEffect(() => {
    if (formData.source_type === 'contract' && formData.contract_id) {
      const contract = contracts?.find(c => c.id === formData.contract_id);
      if (contract?.total_amount) {
        setFormData(prev => ({ ...prev, base_amount: Number(contract.total_amount) }));
      }
    } else if (formData.source_type === 'budget' && formData.budget_id) {
      const budget = budgets?.find(b => b.id === formData.budget_id);
      if (budget?.total_amount) {
        setFormData(prev => ({ ...prev, base_amount: Number(budget.total_amount) }));
      }
    }
  }, [formData.contract_id, formData.budget_id, formData.source_type, contracts, budgets]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        seller_user_id: formData.seller_user_id,
        contract_id: formData.source_type === 'contract' ? formData.contract_id : null,
        budget_id: formData.source_type === 'budget' ? formData.budget_id : null,
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
      toast({ title: 'Error', description: 'Selecciona un vendedor', variant: 'destructive' });
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
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Nueva Comisión' : mode === 'edit' ? 'Editar Comisión' : 'Ver Comisión'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Crea una nueva comisión de ventas' 
              : mode === 'edit' 
                ? 'Modifica los datos de la comisión'
                : 'Detalles de la comisión'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Vendedor *</Label>
            <Select
              value={formData.seller_user_id}
              onValueChange={(v) => setFormData(prev => ({ ...prev, seller_user_id: v }))}
              disabled={isViewMode}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar vendedor" />
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

          <div className="space-y-2">
            <Label>Origen</Label>
            <Select
              value={formData.source_type}
              onValueChange={(v) => setFormData(prev => ({ 
                ...prev, 
                source_type: v as 'contract' | 'budget',
                contract_id: '',
                budget_id: '',
                base_amount: 0,
              }))}
              disabled={isViewMode}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contract">Contrato</SelectItem>
                <SelectItem value="budget">Presupuesto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.source_type === 'contract' ? (
            <div className="space-y-2">
              <Label>Contrato *</Label>
              <Select
                value={formData.contract_id}
                onValueChange={(v) => setFormData(prev => ({ ...prev, contract_id: v }))}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar contrato" />
                </SelectTrigger>
                <SelectContent>
                  {contracts?.map((contract) => (
                    <SelectItem key={contract.id} value={contract.id}>
                      {contract.code} - {contract.title} ({contract.client?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Presupuesto *</Label>
              <Select
                value={formData.budget_id}
                onValueChange={(v) => setFormData(prev => ({ ...prev, budget_id: v }))}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar presupuesto" />
                </SelectTrigger>
                <SelectContent>
                  {budgets?.map((budget) => (
                    <SelectItem key={budget.id} value={budget.id}>
                      {budget.code} - {budget.title} ({budget.client?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Comisión Calculada (€)</Label>
              <Input
                type="number"
                value={formData.commission_amount}
                readOnly
                className="bg-muted"
              />
            </div>
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

          {!isViewMode && (
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
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
            </div>
          )}

          {isViewMode && (
            <div className="flex justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
