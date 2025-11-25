import React, { useState, useEffect } from 'react';
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
import { BudgetItemsEditor } from './BudgetItemsEditor';
import { calculateBudgetTotal } from '@/lib/budget-utils';
import { Loader2, FileText, Send, CheckCircle, XCircle } from 'lucide-react';
import { useApproveBudget } from '@/hooks/useApproveBudget';
import { ProjectCreationModal } from './ProjectCreationModal';

interface BudgetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  budget?: any;
  mode?: 'create' | 'edit' | 'view';
  onProjectCreationRequest?: (budget: any) => void;
}

export const BudgetFormModal = ({ 
  isOpen, 
  onClose, 
  budget, 
  mode = 'create',
  onProjectCreationRequest 
}: BudgetFormModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    description: '',
    valid_until: '',
    status: 'pending',
  });
  const [items, setItems] = useState<any[]>([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [approvedBudgetData, setApprovedBudgetData] = useState<any>(null);

  const approveBudgetMutation = useApproveBudget();

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
    if (budget) {
      setFormData({
        title: budget.title || '',
        client_id: budget.client_id || '',
        description: budget.description || '',
        valid_until: budget.valid_until || '',
        status: budget.status || 'pending',
      });
    } else {
      setFormData({
        title: '',
        client_id: '',
        description: '',
        valid_until: '',
        status: 'pending',
      });
      setItems([]);
    }
  }, [budget, isOpen]);

  // Cargar items si está en modo edición/visualización
  const { data: budgetItems } = useQuery({
    queryKey: ['budget-items', budget?.id],
    queryFn: async () => {
      if (!budget?.id) return [];
      
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('budget_id', budget.id)
        .order('created_at');
      
      if (error) throw error;
      return data;
    },
    enabled: !!budget?.id && isOpen,
  });

  useEffect(() => {
    if (budgetItems) {
      setItems(budgetItems);
    }
  }, [budgetItems]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const totalAmount = calculateBudgetTotal(items);

      if (budget?.id) {
        // Actualizar presupuesto
        const { error: budgetError } = await supabase
          .from('budgets')
          .update({
            ...formData,
            total_amount: totalAmount,
          })
          .eq('id', budget.id);

        if (budgetError) throw budgetError;

        // Eliminar items antiguos y crear nuevos
        await supabase.from('budget_items').delete().eq('budget_id', budget.id);

        if (items.length > 0) {
          const itemsToInsert = items.map((item) => ({
            budget_id: budget.id,
            service_id: item.service_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
            notes: item.notes,
          }));

          const { error: itemsError } = await supabase
            .from('budget_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }
      } else {
        // Crear nuevo presupuesto
        const { data: newBudget, error: budgetError } = await supabase
          .from('budgets')
          .insert({
            ...formData,
            total_amount: totalAmount,
            created_by: user?.id,
          })
          .select()
          .single();

        if (budgetError) throw budgetError;

        if (items.length > 0) {
          const itemsToInsert = items.map((item) => ({
            budget_id: newBudget.id,
            service_id: item.service_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
            notes: item.notes,
          }));

          const { error: itemsError } = await supabase
            .from('budget_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success(budget ? 'Presupuesto actualizado' : 'Presupuesto creado correctamente');
      onClose();
    },
    onError: (error: any) => {
      toast.error('Error al guardar el presupuesto: ' + error.message);
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!budget?.id) return;

      const { error } = await supabase
        .from('budgets')
        .update({ status: newStatus })
        .eq('id', budget.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Estado actualizado correctamente');
      onClose();
    },
    onError: (error: any) => {
      toast.error('Error al cambiar el estado: ' + error.message);
    },
  });

  const handleSave = () => {
    if (!formData.title || !formData.client_id) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    if (items.length === 0) {
      toast.error('Debes añadir al menos una línea al presupuesto');
      return;
    }

    saveMutation.mutate();
  };

  const handleSend = () => {
    changeStatusMutation.mutate('sent');
  };

  const handleApprove = async () => {
    if (!budget?.id) return;

    // Primero obtener los datos completos del presupuesto
    const { data: fullBudget } = await supabase
      .from('budgets')
      .select(`
        *,
        client:clients(id, name),
        budget_items(*)
      `)
      .eq('id', budget.id)
      .single();

    approveBudgetMutation.mutate(
      { 
        budgetId: budget.id,
        onSuccess: () => {
          setApprovedBudgetData(fullBudget);
          setShowProjectModal(true);
          onClose();
        }
      }
    );
  };

  const handleCreateProject = () => {
    setShowProjectModal(false);
    if (onProjectCreationRequest && approvedBudgetData) {
      onProjectCreationRequest(approvedBudgetData);
    }
  };

  const handleReject = () => {
    changeStatusMutation.mutate('rejected');
  };

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const canEdit = !isViewMode && formData.status === 'pending';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isViewMode ? 'Ver Presupuesto' : budget ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
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
                placeholder="Ej: Presupuesto Marketing 2025"
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
              <Label htmlFor="valid_until">Válido Hasta</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={formData.status} disabled className="capitalize" />
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
              placeholder="Describe el presupuesto..."
            />
          </div>

          <BudgetItemsEditor items={items} onChange={setItems} disabled={!canEdit} />
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

          {isViewMode && budget?.status === 'pending' && (
            <Button onClick={handleSend} disabled={changeStatusMutation.isPending}>
              <Send className="h-4 w-4 mr-2" />
              Enviar
            </Button>
          )}

          {isViewMode && budget?.status === 'sent' && (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={changeStatusMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rechazar
              </Button>
              <Button 
                onClick={handleApprove} 
                disabled={approveBudgetMutation.isPending}
              >
                {approveBudgetMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <CheckCircle className="h-4 w-4 mr-2" />
                Aprobar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ProjectCreationModal
      isOpen={showProjectModal}
      onClose={() => setShowProjectModal(false)}
      budget={approvedBudgetData}
      onCreateProject={handleCreateProject}
    />
  </>
  );
};
