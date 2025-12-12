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
import { Loader2, FileText, User } from 'lucide-react';
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
    client_contact_id: '',
    description: '',
    valid_until: '',
    status: 'pending',
    accepted_document_url: '',
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

  // Load contacts for selected client
  const { data: contacts } = useQuery({
    queryKey: ['contacts-for-budget', formData.client_id],
    queryFn: async () => {
      if (!formData.client_id) return [];
      const { data, error } = await supabase
        .from('client_contacts')
        .select('id, name, email, role')
        .eq('client_id', formData.client_id)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!formData.client_id,
  });

  useEffect(() => {
    if (budget) {
      setFormData({
        title: budget.title || '',
        client_id: budget.client_id || '',
        client_contact_id: budget.client_contact_id || '',
        description: budget.description || '',
        valid_until: budget.valid_until || '',
        status: budget.status || 'pending',
        accepted_document_url: budget.accepted_document_url || '',
      });
    } else {
      setFormData({
        title: '',
        client_id: '',
        client_contact_id: '',
        description: '',
        valid_until: '',
        status: 'pending',
        accepted_document_url: '',
      });
      setItems([]);
    }
  }, [budget, isOpen]);

  // Clear contact when client changes
  useEffect(() => {
    if (formData.client_id && budget?.client_id && formData.client_id !== budget.client_id) {
      setFormData(prev => ({ ...prev, client_contact_id: '' }));
    }
  }, [formData.client_id, budget?.client_id]);

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
            specialist_id: item.specialist_id || null,
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

        // Registrar en activity_log
        await supabase.from('activity_log').insert({
          entity_type: 'budget',
          entity_id: budget.id,
          action: 'update_modal',
          changes: { updated_fields: Object.keys(formData), items_count: items.length },
          user_id: user?.id,
        });
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
            specialist_id: item.specialist_id || null,
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
      queryClient.invalidateQueries({ queryKey: ['budget-detail'] });
      toast.success(budget ? 'Presupuesto actualizado' : 'Presupuesto creado correctamente');
      onClose();
    },
    onError: (error: any) => {
      toast.error('Error al guardar el presupuesto: ' + error.message);
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

    if (items.some((item) => !item.service_id)) {
      toast.error('Todas las líneas del presupuesto deben tener un servicio seleccionado.');
      return;
    }

    saveMutation.mutate();
  };

  const handleCreateProject = () => {
    setShowProjectModal(false);
    if (onProjectCreationRequest && approvedBudgetData) {
      onProjectCreationRequest(approvedBudgetData);
    }
  };

  const isViewMode = mode === 'view';
  const canEdit = !isViewMode; // Permitir edición en cualquier estado

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
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Contact Selector */}
            <div className="col-span-2 space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Contacto Solicitante
              </Label>
              <Select
                value={formData.client_contact_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, client_contact_id: value === 'none' ? '' : value })}
                disabled={!canEdit || !formData.client_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin especificar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin especificar</SelectItem>
                  {contacts?.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name} {contact.role ? `(${contact.role})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Persona del cliente que solicita este presupuesto
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Objetivo de campaña / Resumen</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={!canEdit}
              rows={3}
              placeholder="Describe brevemente el objetivo de la campaña, componentes incluidos, mercados, etc."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accepted_document_url">Enlace al documento aceptado</Label>
              <Input
                id="accepted_document_url"
                type="url"
                placeholder="https://..."
                value={formData.accepted_document_url}
                onChange={(e) => setFormData({ ...formData, accepted_document_url: e.target.value })}
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Enlace al PDF o documento de presupuesto firmado/aceptado por el cliente.
              </p>
            </div>
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
