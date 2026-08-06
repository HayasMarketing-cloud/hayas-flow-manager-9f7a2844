import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const specialistTypes = [
  { value: "interno", label: "Interno" },
  { value: "freelance", label: "Freelance" },
  { value: "partner", label: "Partner" },
] as const;

const formSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  type: z.enum(["interno", "freelance", "partner"], {
    required_error: "El tipo es obligatorio",
  }),
  active: z.boolean(),
  receives_flow_notifications: z.boolean(),
  hourly_rate: z.coerce.number().min(0, "La tarifa no puede ser negativa").optional(),
  website_url: z.string().optional(),
  notes: z.string().optional(),
  team_leader_id: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Specialist {
  id: string;
  name: string;
  email: string | null;
  type: "interno" | "freelance" | "partner" | null;
  active: boolean;
  receives_flow_notifications?: boolean | null;
  hourly_rate: number | null;
  website_url: string | null;
  notes: string | null;
  team_leader_id: string | null;
}

interface SpecialistFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialist?: Specialist | null;
}

export function SpecialistFormModal({
  open,
  onOpenChange,
  specialist,
}: SpecialistFormModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!specialist;

  // Query para obtener especialistas potenciales como líderes (excluir el actual y sus miembros)
  const { data: potentialLeaders } = useQuery({
    queryKey: ['specialists-for-leader', specialist?.id],
    queryFn: async () => {
      let query = supabase
        .from('specialists')
        .select('id, name, team_leader_id')
        .eq('active', true)
        .order('name');
      
      // Excluir el especialista actual si estamos editando
      if (specialist?.id) {
        query = query.neq('id', specialist.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Solo mostrar especialistas que no son miembros de otro equipo (team_leader_id = null)
      // o que ya son líderes (otros apuntan a ellos)
      return data?.filter(s => !s.team_leader_id) || [];
    },
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      type: "freelance",
      active: true,
      receives_flow_notifications: true,
      hourly_rate: 0,
      website_url: "",
      notes: "",
      team_leader_id: null,
    },
  });

  useEffect(() => {
    if (specialist) {
      form.reset({
        name: specialist.name,
        email: specialist.email || "",
        type: specialist.type || "freelance",
        active: specialist.active,
        receives_flow_notifications:
          (specialist as any).receives_flow_notifications !== false,
        hourly_rate: specialist.hourly_rate || 0,
        website_url: (specialist as any).website_url || "",
        notes: specialist.notes || "",
        team_leader_id: specialist.team_leader_id || null,
      });
    } else {
      form.reset({
        name: "",
        email: "",
        type: "freelance",
        active: true,
        receives_flow_notifications: true,
        hourly_rate: 0,
        website_url: "",
        notes: "",
        team_leader_id: null,
      });
    }
  }, [specialist, form]);

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { error } = await supabase.from("specialists").insert({
        name: values.name,
        email: values.email || null,
        type: values.type,
        active: values.active,
        receives_flow_notifications: values.receives_flow_notifications,
        hourly_rate: values.hourly_rate || 0,
        website_url: values.website_url || null,
        notes: values.notes || null,
        team_leader_id: values.team_leader_id || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specialists"] });
      toast.success("Especialista creado correctamente");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error creating specialist:", error);
      toast.error("Error al crear el especialista");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { error } = await supabase
        .from("specialists")
        .update({
          name: values.name,
          email: values.email || null,
          type: values.type,
          active: values.active,
          receives_flow_notifications: values.receives_flow_notifications,
          hourly_rate: values.hourly_rate || 0,
          website_url: values.website_url || null,
          notes: values.notes || null,
          team_leader_id: values.team_leader_id || null,
        })
        .eq("id", specialist!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specialists"] });
      toast.success("Especialista actualizado correctamente");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating specialist:", error);
      toast.error("Error al actualizar el especialista");
    },
  });

  const onSubmit = (values: FormValues) => {
    if (isEditing) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Especialista" : "Nuevo Especialista"}
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
                    <Input placeholder="Nombre del especialista" {...field} />
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
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {specialistTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
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
              name="hourly_rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarifa por hora (€/hora)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Tarifa estándar del especialista. Se usa para pre-rellenar costes en solicitudes.
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sitio web</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://ejemplo.com"
                      {...field}
                      value={field.value || ""}
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
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Activo</FormLabel>
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

            <FormField
              control={form.control}
              name="receives_flow_notifications"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Recibe notificaciones de FLOW</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Desactívalo para proveedores gestionados por email que no usan FLOW.
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



            <FormField
              control={form.control}
              name="team_leader_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Líder de equipo</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin líder (independiente)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sin líder (independiente)</SelectItem>
                      {potentialLeaders?.map((leader) => (
                        <SelectItem key={leader.id} value={leader.id}>
                          {leader.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Si seleccionas un líder, este especialista formará parte de su equipo y las liquidaciones se consolidarán.
                  </p>
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

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? "Guardando..."
                  : isEditing
                  ? "Guardar cambios"
                  : "Crear especialista"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
