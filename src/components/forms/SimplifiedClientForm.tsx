import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const clientSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  code: z.string().optional(),
  tax_id: z.string().trim().max(50, 'Máximo 50 caracteres').optional(),
  email: z.string().trim().email('Email inválido').max(255, 'Máximo 255 caracteres').optional().or(z.literal('')),
  phone: z.string().trim().max(20, 'Máximo 20 caracteres').optional(),
  address: z.string().trim().max(255, 'Máximo 255 caracteres').optional(),
  postal_code: z.string().trim().max(20, 'Máximo 20 caracteres').optional(),
  city: z.string().trim().max(100, 'Máximo 100 caracteres').optional(),
  country: z.string().trim().max(100, 'Máximo 100 caracteres').optional(),
  drive_folder_url: z.string().trim().url('URL inválida').optional().or(z.literal('')),
  notes: z.string().trim().max(1000, 'Máximo 1000 caracteres').optional(),
  default_hourly_rate: z.coerce.number().min(0, 'No puede ser negativo').optional().nullable(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface SimplifiedClientFormProps {
  initialData?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const SimplifiedClientForm = ({
  initialData,
  onSuccess,
  onCancel,
}: SimplifiedClientFormProps) => {
  const { user } = useAuth();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: initialData?.name || '',
      code: initialData?.code || '',
      tax_id: initialData?.tax_id || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      address: initialData?.address || '',
      postal_code: initialData?.postal_code || '',
      city: initialData?.city || '',
      country: initialData?.country || '',
      drive_folder_url: initialData?.drive_folder_url || '',
      notes: initialData?.notes || '',
      default_hourly_rate: initialData?.default_hourly_rate ?? null,
    },
  });

  const generateCode = (name: string) => {
    const prefix = name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}${timestamp}`;
  };

  const onSubmit = async (values: ClientFormValues) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'Debes estar autenticado',
        variant: 'destructive',
      });
      return;
    }

    try {
      const dataToSave = {
        ...values,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
        postal_code: values.postal_code || null,
        city: values.city || null,
        country: values.country || null,
        tax_id: values.tax_id || null,
        drive_folder_url: values.drive_folder_url || null,
        notes: values.notes || null,
        default_hourly_rate: values.default_hourly_rate ?? null,
      };

      if (initialData?.id) {
        // Actualizar
        const { error } = await supabase
          .from('clients')
          .update(dataToSave)
          .eq('id', initialData.id);

        if (error) throw error;

        toast({
          title: 'Cliente actualizado',
          description: 'Los cambios se guardaron correctamente',
        });
      } else {
        // Crear nuevo
        const code = generateCode(values.name);
        const { error } = await supabase.from('clients').insert({
          name: dataToSave.name,
          code,
          tax_id: dataToSave.tax_id,
          email: dataToSave.email,
          phone: dataToSave.phone,
          address: dataToSave.address,
          postal_code: dataToSave.postal_code,
          city: dataToSave.city,
          country: dataToSave.country,
          drive_folder_url: dataToSave.drive_folder_url,
          notes: dataToSave.notes,
          default_hourly_rate: dataToSave.default_hourly_rate,
          created_by: user.id,
        } as any);

        if (error) throw error;

        toast({
          title: 'Cliente creado',
          description: 'El cliente se creó correctamente',
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Ocurrió un error al guardar',
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre *</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre del cliente" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Auto-generado"
                    {...field}
                    disabled
                    className="bg-muted"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tax_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>RFC / Tax ID</FormLabel>
                <FormControl>
                  <Input placeholder="RFC o Tax ID" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@ejemplo.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input placeholder="+52 555 123 4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem className="col-span-1 md:col-span-2">
                <FormLabel>Dirección</FormLabel>
                <FormControl>
                  <Input placeholder="Dirección completa" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="postal_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código Postal</FormLabel>
                <FormControl>
                  <Input placeholder="28001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ciudad</FormLabel>
                <FormControl>
                  <Input placeholder="Ciudad" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>País</FormLabel>
                <FormControl>
                  <Input placeholder="País" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="drive_folder_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer DRIVE</FormLabel>
              <FormControl>
                <Input 
                  type="url" 
                  placeholder="https://drive.google.com/..." 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="default_hourly_rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tarifa hora por defecto (€)</FormLabel>
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
                    field.onChange(val === '' ? null : parseFloat(val));
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Notas adicionales..."
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Form>
  );
};
