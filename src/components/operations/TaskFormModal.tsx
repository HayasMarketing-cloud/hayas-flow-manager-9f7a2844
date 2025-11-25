import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import React from "react";

const formSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  milestone_id: z.string().min(1, "El milestone es requerido"),
  assignee_user_id: z.string().optional(),
  assignee_specialist_id: z.string().optional(),
  deadline: z.string().optional(),
  context_url: z.string().url().optional().or(z.literal("")),
  status: z.enum(["pending", "in_progress", "in_review", "completed"]).optional(),
  notes: z.string().optional(),
  order_index: z.number().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface TaskFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: string | null;
  milestoneId?: string;
  mode?: "create" | "edit" | "view";
}

export function TaskFormModal({
  open,
  onOpenChange,
  taskId,
  milestoneId,
  mode = "create",
}: TaskFormModalProps) {
  const queryClient = useQueryClient();
  const isReadOnly = mode === "view";

  const { data: task, isLoading: isLoadingTask } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          milestone:milestones(id, name),
          assignee_user:profiles!tasks_assignee_user_id_fkey(id, full_name),
          assignee_specialist:specialists!tasks_assignee_specialist_id_fkey(id, name)
        `)
        .eq("id", taskId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestones")
        .select("id, name, operational_request:operational_requests(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: specialists = [] } = useQuery({
    queryKey: ["specialists-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specialists")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      milestone_id: milestoneId || "",
      status: "pending",
      order_index: 0,
    },
  });

  React.useEffect(() => {
    if (task) {
      reset({
        name: task.name,
        description: task.description || "",
        milestone_id: task.milestone_id,
        assignee_user_id: task.assignee_user_id || "",
        assignee_specialist_id: task.assignee_specialist_id || "",
        deadline: task.deadline || "",
        context_url: task.context_url || "",
        status: task.status || "pending",
        notes: task.notes || "",
        order_index: task.order_index || 0,
      });
    } else if (milestoneId) {
      reset({
        milestone_id: milestoneId,
        status: "pending",
        order_index: 0,
      });
    }
  }, [task, milestoneId, reset]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("tasks").insert([
        {
          name: data.name,
          description: data.description || null,
          milestone_id: data.milestone_id,
          assignee_user_id: data.assignee_user_id || null,
          assignee_specialist_id: data.assignee_specialist_id || null,
          deadline: data.deadline || null,
          context_url: data.context_url || null,
          status: data.status || "pending",
          notes: data.notes || null,
          order_index: data.order_index || 0,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      toast.success("Tarea creada");
      onOpenChange(false);
      reset();
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!taskId) return;
      const { error } = await supabase
        .from("tasks")
        .update({
          name: data.name,
          description: data.description || null,
          milestone_id: data.milestone_id,
          assignee_user_id: data.assignee_user_id || null,
          assignee_specialist_id: data.assignee_specialist_id || null,
          deadline: data.deadline || null,
          context_url: data.context_url || null,
          status: data.status,
          notes: data.notes || null,
          order_index: data.order_index,
        })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      toast.success("Tarea actualizada");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const onSubmit = (data: FormData) => {
    if (mode === "edit") {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = isLoadingTask || createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" && "Nueva Tarea"}
            {mode === "edit" && "Editar Tarea"}
            {mode === "view" && "Detalle Tarea"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              {...register("name")}
              disabled={isReadOnly}
              placeholder="Nombre de la tarea"
            />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="milestone_id">Milestone *</Label>
            <Select
              value={watch("milestone_id")}
              onValueChange={(value) => setValue("milestone_id", value)}
              disabled={isReadOnly || !!milestoneId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar milestone" />
              </SelectTrigger>
              <SelectContent>
                {milestones.map((milestone) => (
                  <SelectItem key={milestone.id} value={milestone.id}>
                    {milestone.name}
                    {milestone.operational_request && (
                      <span className="text-muted-foreground text-xs ml-2">
                        ({milestone.operational_request.name})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.milestone_id && (
              <p className="text-sm text-destructive mt-1">{errors.milestone_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assignee_user_id">Asignar Usuario</Label>
              <Select
                value={watch("assignee_user_id") || ""}
                onValueChange={(value) => setValue("assignee_user_id", value)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ninguno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Ninguno</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || "Sin nombre"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="assignee_specialist_id">Asignar Especialista</Label>
              <Select
                value={watch("assignee_specialist_id") || ""}
                onValueChange={(value) => setValue("assignee_specialist_id", value)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ninguno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Ninguno</SelectItem>
                  {specialists.map((specialist) => (
                    <SelectItem key={specialist.id} value={specialist.id}>
                      {specialist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Estado</Label>
              <Select
                value={watch("status")}
                onValueChange={(value) => setValue("status", value as any)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="in_review">En Revisión</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="order_index">Orden</Label>
              <Input
                id="order_index"
                type="number"
                {...register("order_index", { valueAsNumber: true })}
                disabled={isReadOnly}
                min={0}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="deadline">Fecha límite</Label>
            <Input
              id="deadline"
              type="date"
              {...register("deadline")}
              disabled={isReadOnly}
            />
          </div>

          <div>
            <Label htmlFor="context_url">URL de Contexto</Label>
            <Input
              id="context_url"
              {...register("context_url")}
              disabled={isReadOnly}
              placeholder="https://..."
            />
            {errors.context_url && (
              <p className="text-sm text-destructive mt-1">{errors.context_url.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              {...register("description")}
              disabled={isReadOnly}
              rows={3}
              placeholder="Descripción de la tarea"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              disabled={isReadOnly}
              rows={2}
              placeholder="Notas adicionales"
            />
          </div>

          {!isReadOnly && (
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "edit" ? "Actualizar" : "Crear"}
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
