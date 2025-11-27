import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';

const contactSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(100),
  email: z.string().email('Email inválido').max(255),
  role: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  address_line_1: z.string().max(255).optional(),
  address_line_2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postal_code: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  is_primary: z.boolean().default(false),
  active: z.boolean().default(true),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  initialData?: any;
  onSuccess: () => void;
}

export const ContactFormModal = ({
  open,
  onOpenChange,
  clientId,
  initialData,
  onSuccess,
}: ContactFormModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: initialData?.name || '',
      email: initialData?.email || '',
      role: initialData?.role || '',
      phone: initialData?.phone || '',
      address_line_1: initialData?.address_line_1 || '',
      address_line_2: initialData?.address_line_2 || '',
      city: initialData?.city || '',
      state: initialData?.state || '',
      postal_code: initialData?.postal_code || '',
      country: initialData?.country || '',
      notes: initialData?.notes || '',
      is_primary: initialData?.is_primary || false,
      active: initialData?.active ?? true,
    },
  });

  // Reset form when initialData changes (fixes race condition when editing different contacts)
  useEffect(() => {
    if (open) {
      form.reset({
        name: initialData?.name || '',
        email: initialData?.email || '',
        role: initialData?.role || '',
        phone: initialData?.phone || '',
        address_line_1: initialData?.address_line_1 || '',
        address_line_2: initialData?.address_line_2 || '',
        city: initialData?.city || '',
        state: initialData?.state || '',
        postal_code: initialData?.postal_code || '',
        country: initialData?.country || '',
        notes: initialData?.notes || '',
        is_primary: initialData?.is_primary || false,
        active: initialData?.active ?? true,
      });
    }
  }, [open, initialData, form]);

  const onSubmit = async (values: ContactFormValues) => {
    setIsSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Debes iniciar sesión para guardar contactos');
        return;
      }

      const contactData = {
        client_id: clientId,
        name: values.name.trim(),
        email: values.email.trim(),
        role: values.role?.trim() || null,
        phone: values.phone?.trim() || null,
        address_line_1: values.address_line_1?.trim() || null,
        address_line_2: values.address_line_2?.trim() || null,
        city: values.city?.trim() || null,
        state: values.state?.trim() || null,
        postal_code: values.postal_code?.trim() || null,
        country: values.country?.trim() || null,
        notes: values.notes?.trim() || null,
        is_primary: values.is_primary,
        active: values.active,
      };

      if (initialData?.id) {
        // Update existing contact
        const { error } = await supabase
          .from('client_contacts')
          .update(contactData)
          .eq('id', initialData.id);

        if (error) throw error;
        toast.success('Contacto actualizado');
      } else {
        // Create new contact
        const { error } = await supabase.from('client_contacts').insert({
          ...contactData,
          created_by: user.id,
        });

        if (error) throw error;
        toast.success('Contacto creado');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving contact:', error);
      toast.error('Error al guardar contacto: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Editar Contacto' : 'Nuevo Contacto'}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-8rem)]">
          <div className="px-1 py-1">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre completo" {...field} />
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
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="email@ejemplo.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cargo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: CEO, CFO, PM" {...field} />
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
                          <Input placeholder="+34 123 456 789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Address section */}
                <div>
                  <h4 className="text-sm font-medium mb-4">Dirección</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="address_line_1"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Dirección Línea 1</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Calle, número"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address_line_2"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Dirección Línea 2</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Piso, puerta, empresa..."
                              {...field}
                            />
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
                            <Input placeholder="Madrid" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Provincia/Estado</FormLabel>
                          <FormControl>
                            <Input placeholder="Madrid" {...field} />
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
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>País</FormLabel>
                          <FormControl>
                            <Input placeholder="España" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Notas adicionales sobre el contacto..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Switches */}
                <div className="flex flex-col sm:flex-row gap-6">
                  <FormField
                    control={form.control}
                    name="is_primary"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-3">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <Label className="!mt-0">Contacto Principal</Label>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-3">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <Label className="!mt-0">Activo</Label>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
