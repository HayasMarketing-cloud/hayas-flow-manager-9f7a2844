import { useEffect } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateOperationalProject, useUpdateOperationalProject } from '@/hooks/useOperationalProjects';
import { Loader2 } from 'lucide-react';

const projectSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres'),
  client_id: z.string().uuid('Selecciona un cliente'),
  contract_id: z.string().uuid().optional().nullable(),
  budget_id: z.string().uuid().optional().nullable(),
  owner_user_id: z.string().uuid().optional().nullable(),
  deadline: z.string().optional().nullable(),
  status: z.enum(['pending', 'in_progress', 'in_review', 'completed']),
  description: z.string().optional().nullable(),
  hub_project_url: z.string().url('URL inválida').optional().nullable().or(z.literal('')),
  drive_folder_url: z.string().url('URL inválida').optional().nullable().or(z.literal('')),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface OperationalProjectFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any | null;
  mode?: 'create' | 'edit' | 'view';
  defaultClientId?: string;
}

export const OperationalProjectFormModal = ({
  open,
  onOpenChange,
  initialData,
  mode = 'create',
  defaultClientId,
}: OperationalProjectFormModalProps) => {

  const { user } = useAuth();
  const isViewMode = mode === 'view';
  const createMutation = useCreateOperationalProject();
  const updateMutation = useUpdateOperationalProject();

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      client_id: '',
      contract_id: null,
      budget_id: null,
      owner_user_id: user?.id || null,
      deadline: null,
      status: 'pending',
      description: null,
      hub_project_url: null,
      drive_folder_url: null,
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-active'],
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

  const { data: contracts } = useQuery({
    queryKey: ['contracts-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, title, client_id')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: budgets } = useQuery({
    queryKey: ['budgets-approved'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('id, title, client_id')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users-list'],
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
    if (initialData) {
      form.reset({
        name: initialData.name,
        client_id: initialData.client_id,
        contract_id: initialData.contract_id || null,
        budget_id: initialData.budget_id || null,
        owner_user_id: initialData.owner_user_id || null,
        deadline: initialData.deadline || null,
        status: initialData.status,
        description: initialData.description || null,
        hub_project_url: initialData.hub_project_url || null,
        drive_folder_url: initialData.drive_folder_url || null,
      });
    } else {
      form.reset({
        name: '',
        client_id: '',
        contract_id: null,
        budget_id: null,
        owner_user_id: user?.id || null,
        deadline: null,
        status: 'pending',
        description: null,
        hub_project_url: null,
        drive_folder_url: null,
      });
    }
  }, [initialData, user?.id, form]);

  const selectedClientId = form.watch('client_id');

  const filteredContracts = contracts?.filter(
    (c) => !selectedClientId || c.client_id === selectedClientId
  );

  const filteredBudgets = budgets?.filter(
    (b) => !selectedClientId || b.client_id === selectedClientId
  );

  const onSubmit = async (data: ProjectFormData) => {
    const payload = {
      ...data,
      contract_id: data.contract_id || null,
      budget_id: data.budget_id || null,
      owner_user_id: data.owner_user_id || null,
      deadline: data.deadline || null,
      description: data.description || null,
      hub_project_url: data.hub_project_url || null,
      drive_folder_url: data.drive_folder_url || null,
      created_by: user?.id,
    };

    if (initialData) {
      await updateMutation.mutateAsync({ id: initialData.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }

    onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isViewMode
              ? 'Detalles del Proyecto'
              : initialData
              ? 'Editar Proyecto Operativo'
              : 'Nuevo Proyecto Operativo'}
          </DialogTitle>
          <DialogDescription>
            {isViewMode
              ? 'Información completa del proyecto operativo'
              : 'Completa los datos para gestionar el proyecto operativo'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Proyecto *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Plan Marketing 2025"
                      {...field}
                      disabled={isViewMode}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                            {client.name}
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
                name="owner_user_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsable (Owner)</FormLabel>
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
                        {users?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name || user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contract_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contrato (Opcional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value || ''}
                      disabled={isViewMode || !selectedClientId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin contrato" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="null">Sin contrato</SelectItem>
                        {filteredContracts?.map((contract) => (
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

              <FormField
                control={form.control}
                name="budget_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Presupuesto (Opcional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value || ''}
                      disabled={isViewMode || !selectedClientId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin presupuesto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="null">Sin presupuesto</SelectItem>
                        {filteredBudgets?.map((budget) => (
                          <SelectItem key={budget.id} value={budget.id}>
                            {budget.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="in_progress">En Progreso</SelectItem>
                        <SelectItem value="in_review">En Revisión</SelectItem>
                        <SelectItem value="completed">Completado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descripción del proyecto..."
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

            <FormField
              control={form.control}
              name="hub_project_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL HUB Proyecto</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://..."
                      {...field}
                      value={field.value || ''}
                      disabled={isViewMode}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="drive_folder_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project DRIVE</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://drive.google.com/..."
                      {...field}
                      value={field.value || ''}
                      disabled={isViewMode}
                    />
                  </FormControl>
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
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
