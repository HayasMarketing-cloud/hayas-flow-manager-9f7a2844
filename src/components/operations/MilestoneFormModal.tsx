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
  operational_request_id: z.string().min(1, "El request es requerido"),
  assignee_user_id: z.string().optional(),
  assignee_specialist_id: z.string().optional(),
  deadline: z.string().optional(),
  context_url: z.string().url().optional().or(z.literal("")),
  reviewer_type: z.enum(["am", "client"]).optional(),
  status: z.enum(["pending", "in_progress", "in_review", "completed"]).optional(),
  notes: z.string().optional(),
  order_index: z.number().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface MilestoneFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestoneId?: string | null;
  requestId?: string;
  mode?: "create" | "edit" | "view";
}

export function MilestoneFormModal({
  open,
  onOpenChange,
  milestoneId,
  requestId,
  mode = "create",
}: MilestoneFormModalProps) {
  const queryClient = useQueryClient();
  const isReadOnly = mode === "view";

  const { data: milestone, isLoading: isLoadingMilestone } = useQuery({
    queryKey: ["milestone", milestoneId],
    queryFn: async () => {
      if (!milestoneId) return null;
      const { data, error } = await supabase
        .from("milestones")
        .select(`
          *,
          operational_request:operational_requests(id, name),
          assignee_user:profiles!milestones_assignee_user_id_fkey(id, full_name),
          assignee_specialist:specialists!milestones_assignee_specialist_id_fkey(id, name)
        `)
        .eq("id", milestoneId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!milestoneId,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["operational-requests-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operational_requests")
        .select("id, name")
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
      operational_request_id: requestId || "",
      status: "pending",
      order_index: 0,
    },
  });

  React.useEffect(() => {
    if (milestone) {
      reset({
        name: milestone.name,
        description: milestone.description || "",
        operational_request_id: milestone.operational_request_id,
        assignee_user_id: milestone.assignee_user_id || "",
        assignee_specialist_id: milestone.assignee_specialist_id || "",
        deadline: milestone.deadline || "",
        context_url: milestone.context_url || "",
        reviewer_type: milestone.reviewer_type || undefined,
        status: milestone.status || "pending",
        notes: milestone.notes || "",
        order_index: milestone.order_index || 0,
      });
    } else if (requestId) {
      reset({
        operational_request_id: requestId,
        status: "pending",
        order_index: 0,
      });
    }
  }, [milestone, requestId, reset]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("milestones").insert([
        {
          name: data.name,
          description: data.description || null,
          operational_request_id: data.operational_request_id,
          assignee_user_id: data.assignee_user_id || null,
          assignee_specialist_id: data.assignee_specialist_id || null,
          deadline: data.deadline || null,
          context_url: data.context_url || null,
          reviewer_type: data.reviewer_type || null,
          status: data.status || "pending",
          notes: data.notes || null,
          order_index: data.order_index || 0,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["my-milestones"] });
      toast.success("Milestone creado");
      onOpenChange(false);
      reset();
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!milestoneId) return;
      const { error } = await supabase
        .from("milestones")
        .update({
          name: data.name,
          description: data.description || null,
          operational_request_id: data.operational_request_id,
          assignee_user_id: data.assignee_user_id || null,
          assignee_specialist_id: data.assignee_specialist_id || null,
          deadline: data.deadline || null,
          context_url: data.context_url || null,
          reviewer_type: data.reviewer_type || null,
          status: data.status,
          notes: data.notes || null,
          order_index: data.order_index,
        })
        .eq("id", milestoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["milestone", milestoneId] });
      queryClient.invalidateQueries({ queryKey: ["my-milestones"] });
      toast.success("Milestone actualizado");
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

  const isLoading = isLoadingMilestone || createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" && "Nuevo Milestone"}
            {mode === "edit" && "Editar Milestone"}
            {mode === "view" && "Detalle Milestone"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              {...register("name")}
              disabled={isReadOnly}
              placeholder="Nombre del milestone"
            />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="operational_request_id">Request Operativo *</Label>
            <Select
              value={watch("operational_request_id")}
              onValueChange={(value) => setValue("operational_request_id", value)}
              disabled={isReadOnly || !!requestId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar request" />
              </SelectTrigger>
              <SelectContent>
                {requests.map((request) => (
                  <SelectItem key={request.id} value={request.id}>
                    {request.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.operational_request_id && (
              <p className="text-sm text-destructive mt-1">{errors.operational_request_id.message}</p>
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="reviewer_type">Tipo de Revisor</Label>
              <Select
                value={watch("reviewer_type") || ""}
                onValueChange={(value) => setValue("reviewer_type", value as any)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ninguno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Ninguno</SelectItem>
                  <SelectItem value="am">Account Manager</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
              placeholder="Descripción del milestone"
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
