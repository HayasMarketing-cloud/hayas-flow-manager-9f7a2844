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
import { Loader2, FileText, User, FileSignature } from 'lucide-react';
import { useApproveBudget } from '@/hooks/useApproveBudget';
import { ProjectCreationModal } from './ProjectCreationModal';
import { PaymentPlanEditor, PaymentMilestone } from './PaymentPlanEditor';
import { useUserRole } from '@/hooks/useUserRole';

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
  const { isAccountManager, isProjectManager } = useUserRole();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    client_contact_id: '',
    contract_id: '',
    description: '',
    valid_until: '',
    estimated_invoice_date: '',
    client_po_number: '',
    status: 'pending',
    accepted_document_url: '',
    am_user_id: '',
    pm_user_id: '',
  });
  const [items, setItems] = useState<any[]>([]);
  const [paymentPlan, setPaymentPlan] = useState<PaymentMilestone[]>([]);
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

  // Load contracts for selected client
  const { data: contracts } = useQuery({
    queryKey: ['contracts-for-budget', formData.client_id],
    queryFn: async () => {
      if (!formData.client_id) return [];
      const { data, error } = await supabase
        .from('contracts')
        .select('id, title, code, am_user_id, pm_user_id, status')
        .eq('client_id', formData.client_id)
        .in('status', ['active', 'draft'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!formData.client_id,
  });

  // Load profiles for AM/PM assignment
  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (budget) {
      setFormData({
        title: budget.title || '',
        client_id: budget.client_id || '',
        client_contact_id: budget.client_contact_id || '',
        contract_id: budget.contract_id || '',
        description: budget.description || '',
        valid_until: budget.valid_until || '',
        estimated_invoice_date: budget.estimated_invoice_date || '',
        client_po_number: budget.client_po_number || '',
        status: budget.status || 'pending',
        accepted_document_url: budget.accepted_document_url || '',
        am_user_id: budget.am_user_id || '',
        pm_user_id: budget.pm_user_id || '',
      });
      setPaymentPlan(Array.isArray(budget.payment_plan) ? budget.payment_plan : []);
    } else {
      setFormData({
        title: '',
        client_id: '',
        client_contact_id: '',
        contract_id: '',
        description: '',
        valid_until: '',
        estimated_invoice_date: '',
        client_po_number: '',
        status: 'pending',
        accepted_document_url: '',
        am_user_id: '',
        pm_user_id: '',
      });
      setItems([]);
      setPaymentPlan([]);
    }
  }, [budget, isOpen]);

  // Auto-fill AM/PM when contract is selected
  useEffect(() => {
    if (formData.contract_id && contracts) {
      const selectedContract = contracts.find(c => c.id === formData.contract_id);
      if (selectedContract) {
        setFormData(prev => ({
          ...prev,
          am_user_id: selectedContract.am_user_id || prev.am_user_id,
          pm_user_id: selectedContract.pm_user_id || prev.pm_user_id,
        }));
      }
    }
  }, [formData.contract_id, contracts]);

  // Clear contact and contract when client changes
  useEffect(() => {
    if (formData.client_id && budget?.client_id && formData.client_id !== budget.client_id) {
      setFormData(prev => ({ ...prev, client_contact_id: '', contract_id: '' }));
    }
  }, [formData.client_id, budget?.client_id]);

  // Auto-select contact when client has exactly 1 contact
  const hasMultipleContacts = (contacts?.length || 0) >= 2;
  const hasContacts = (contacts?.length || 0) > 0;

  useEffect(() => {
    if (contacts?.length === 1 && !formData.client_contact_id && !budget?.client_contact_id) {
      setFormData(prev => ({ ...prev, client_contact_id: contacts[0].id }));
    }
  }, [contacts, formData.client_contact_id, budget?.client_contact_id]);

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
      if (hasMultipleContacts && !formData.client_contact_id) {
        toast.error('Debes seleccionar un contacto solicitante (este cliente tiene múltiples contactos)');
        throw new Error('client_contact_id required');
      }
      // Validate payment_plan if any milestones defined
      const planSum = paymentPlan.reduce((s, m) => s + (Number(m.percentage) || 0), 0);
      if (paymentPlan.length > 0 && planSum !== 100) {
        toast.error('El plan de pagos debe sumar 100%');
        throw new Error('payment_plan must sum to 100');
      }
      const totalAmount = calculateBudgetTotal(items);

      // Limpiar campos UUID y fecha vacíos para evitar errores de tipo en Postgres
      const cleanedFormData: any = {
        ...formData,
        client_contact_id: formData.client_contact_id || null,
        contract_id: formData.contract_id || null,
        am_user_id: formData.am_user_id || null,
        pm_user_id: formData.pm_user_id || null,
        estimated_invoice_date: formData.estimated_invoice_date || null,
        valid_until: formData.valid_until || null,
        payment_plan: paymentPlan.length > 0 ? (paymentPlan as any) : null,
      };

      if (!budget?.id && user?.id) {
        if (!cleanedFormData.am_user_id && isAccountManager()) {
          cleanedFormData.am_user_id = user.id;
        }
        if (!cleanedFormData.pm_user_id && isProjectManager()) {
          cleanedFormData.pm_user_id = user.id;
        }
      }

      if (budget?.id) {
        // Actualizar presupuesto
        const { error: budgetError } = await supabase
          .from('budgets')
          .update({
            ...cleanedFormData,
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
            ...cleanedFormData,
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

            {/* Contact Selector - Conditional */}
            {hasContacts && (
              <div className="col-span-2 space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contacto Solicitante {hasMultipleContacts && <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={formData.client_contact_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, client_contact_id: value === 'none' ? '' : value })}
                  disabled={!canEdit || !formData.client_id}
                >
                  <SelectTrigger className={hasMultipleContacts && !formData.client_contact_id ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Seleccionar contacto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin contacto</SelectItem>
                    {contacts?.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name} {contact.role ? `(${contact.role})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {hasMultipleContacts 
                    ? 'Persona del cliente que solicita este presupuesto (obligatorio)' 
                    : 'Persona del cliente que solicita este presupuesto (opcional)'}
                </p>
              </div>
            )}

            {/* Contrato Asociado (opcional) */}
            <div className="col-span-2 space-y-2">
              <Label className="flex items-center gap-2">
                <FileSignature className="h-4 w-4" />
                Contrato Asociado
              </Label>
              <Select
                value={formData.contract_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, contract_id: value === 'none' ? '' : value })}
                disabled={!canEdit || !formData.client_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin contrato asociado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin contrato asociado</SelectItem>
                  {contracts?.map((contract) => (
                    <SelectItem key={contract.id} value={contract.id}>
                      {contract.code} - {contract.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Opcional. Al seleccionar un contrato se auto-rellenan AM y PM si están definidos
              </p>
            </div>

            {/* Account Manager */}
            <div className="space-y-2">
              <Label>Account Manager</Label>
              <Select
                value={formData.am_user_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, am_user_id: value === 'none' ? '' : value })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {profiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name || profile.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Manager */}
            <div className="space-y-2">
              <Label>Project Manager</Label>
              <Select
                value={formData.pm_user_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, pm_user_id: value === 'none' ? '' : value })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {profiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name || profile.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* PO Number / Client Reference */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="client_po_number">
                PO Number / Referencia Cliente
              </Label>
              <Input
                id="client_po_number"
                placeholder="Introduce el número de orden de compra o referencia"
                value={formData.client_po_number}
                onChange={(e) => setFormData({ ...formData, client_po_number: e.target.value })}
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Opcional. Si no se indica, se mostrará "Pendiente" en el PDF
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

          <div className="space-y-2">
            <Label htmlFor="accepted_document_url">Enlace a Project HUB</Label>
            <div className="flex items-center gap-2">
              <Input
                id="accepted_document_url"
                type="url"
                placeholder="https://..."
                value={formData.accepted_document_url}
                onChange={(e) => setFormData({ ...formData, accepted_document_url: e.target.value })}
                disabled={!canEdit}
                className="flex-1"
              />
              {formData.accepted_document_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(formData.accepted_document_url, '_blank')}
                >
                  Abrir HUB
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimated_invoice_date">
              Fecha Estimada de Facturación al Cliente
            </Label>
            <Input
              id="estimated_invoice_date"
              type="date"
              value={formData.estimated_invoice_date}
              onChange={(e) => setFormData({ ...formData, estimated_invoice_date: e.target.value })}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">
              Fecha prevista para emitir la factura al cliente
            </p>
          </div>

          <BudgetItemsEditor items={items} onChange={setItems} disabled={!canEdit} />

          <PaymentPlanEditor value={paymentPlan} onChange={setPaymentPlan} disabled={!canEdit} />
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
