import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const SERVICE_CATEGORIES = [
  'Branding & Creatividad',
  'Desarrollo de aplicaciones',
  'Estrategia & Consultoría',
  'Web & UX',
  'SEO & Contenidos',
  'Paid Media',
  'Email & Automatización',
  'CRM & Datos',
  'Formación / Mentoring',
  'Interno / No facturable',
] as const;

const serviceSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100, "Máximo 100 caracteres"),
  description: z.string().max(500, "Máximo 500 caracteres").optional(),
  category: z.string().min(1, "La categoría es obligatoria"),
  active: z.boolean(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  active: boolean;
}

interface ServiceFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service | null;
}

export function ServiceFormModal({ open, onOpenChange, service }: ServiceFormModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!service;

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      active: true,
    },
  });

  useEffect(() => {
    if (service) {
      form.reset({
        name: service.name,
        description: service.description || "",
        category: service.category || "",
        active: service.active,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        category: "",
        active: true,
      });
    }
  }, [service, form]);

  const mutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      if (!user) throw new Error("No autenticado");

      if (isEditing && service) {
        const { error } = await supabase
          .from("services")
          .update({
            name: data.name,
            description: data.description || null,
            category: data.category,
            active: data.active,
          })
          .eq("id", service.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("services")
          .insert({
            name: data.name,
            description: data.description || null,
            category: data.category,
            active: data.active,
            created_by: user.id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({
        title: isEditing ? "Servicio actualizado" : "Servicio creado",
        description: isEditing
          ? "El servicio se ha actualizado correctamente"
          : "El servicio se ha creado correctamente",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Error saving service:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el servicio",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ServiceFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Servicio" : "Nuevo Servicio"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del servicio" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SERVICE_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descripción del servicio (opcional)"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Activo</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Los servicios inactivos no aparecen en los selectores
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending
                  ? "Guardando..."
                  : isEditing
                  ? "Guardar cambios"
                  : "Crear servicio"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
