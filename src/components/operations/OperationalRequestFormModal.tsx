import React from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  operational_project_id: z.string().min(1, "El proyecto es requerido"),
  client_id: z.string().min(1, "El cliente es requerido"),
  financial_request_id: z.string().optional(),
  assignee_specialist_id: z.string().optional(),
  deadline: z.string().optional(),
  context_url: z.string().url().optional().or(z.literal("")),
  status: z.enum(["pending", "in_progress", "in_review", "completed"]).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface OperationalRequestFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId?: string | null;
  projectId?: string;
  mode?: "create" | "edit" | "view";
}

export function OperationalRequestFormModal({
  open,
  onOpenChange,
  requestId,
  projectId,
  mode = "create",
}: OperationalRequestFormModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isReadOnly = mode === "view";

  const { data: request, isLoading: isLoadingRequest } = useQuery({
    queryKey: ["operational-request", requestId],
    queryFn: async () => {
      if (!requestId) return null;
      const { data, error } = await supabase
        .from("operational_requests")
        .select(`
          *,
          operational_project:operational_projects(id, name),
          client:clients(id, name),
          financial_request:financial_requests(id, code, title),
          assignee_user:profiles!operational_requests_assignee_user_id_fkey(id, full_name),
          assignee_specialist:specialists!operational_requests_assignee_specialist_id_fkey(id, name)
        `)
        .eq("id", requestId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["operational-projects-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operational_projects")
        .select("id, name, client_id")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: financialRequests = [] } = useQuery({
    queryKey: ["financial-requests-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_requests")
        .select("id, code, title")
        .order("code", { ascending: false });
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
      operational_project_id: projectId || "",
      status: "pending",
    },
  });

  const selectedProjectId = watch("operational_project_id");
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Auto-set client when project changes
  React.useEffect(() => {
    if (selectedProject) {
      setValue("client_id", selectedProject.client_id);
    }
  }, [selectedProject, setValue]);

  React.useEffect(() => {
    if (request) {
      reset({
        name: request.name,
        description: request.description || "",
        operational_project_id: request.operational_project_id,
        client_id: request.client_id,
        financial_request_id: request.financial_request_id || "",
        assignee_specialist_id: request.assignee_specialist_id || "",
        deadline: request.deadline || "",
        context_url: request.context_url || "",
        status: request.status || "pending",
      });
    } else if (projectId) {
      const project = projects.find((p) => p.id === projectId);
      reset({
        operational_project_id: projectId,
        client_id: project?.client_id || "",
        status: "pending",
      });
    }
  }, [request, projectId, projects, reset]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("operational_requests").insert([
        {
          name: data.name,
          description: data.description || null,
          operational_project_id: data.operational_project_id,
          client_id: data.client_id,
          created_by: user?.id!,
          financial_request_id: data.financial_request_id || null,
          assignee_specialist_id: data.assignee_specialist_id || null,
          deadline: data.deadline || null,
          context_url: data.context_url || null,
          status: data.status || "pending",
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operational-requests"] });
      queryClient.invalidateQueries({ queryKey: ["operational-projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-operational-requests"] });
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
      if (!requestId) return;
      
      const newSpecialistId = data.assignee_specialist_id || null;
      const oldSpecialistId = request?.assignee_specialist_id || null;
      const linkedFinancialRequestId = request?.financial_request_id || data.financial_request_id;
      
      const { error } = await supabase
        .from("operational_requests")
        .update({
          name: data.name,
          description: data.description || null,
          operational_project_id: data.operational_project_id,
          client_id: data.client_id,
          financial_request_id: data.financial_request_id || null,
          assignee_user_id: data.assignee_user_id || null,
          assignee_specialist_id: newSpecialistId,
          deadline: data.deadline || null,
          context_url: data.context_url || null,
          reviewer_type: data.reviewer_type || null,
          status: data.status,
        })
        .eq("id", requestId);
      if (error) throw error;
      
      // Sincronizar specialist_id con financial_request vinculado (si cambió)
      if (linkedFinancialRequestId && newSpecialistId !== oldSpecialistId) {
        await supabase
          .from("financial_requests")
          .update({ specialist_id: newSpecialistId })
          .eq("id", linkedFinancialRequestId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operational-requests"] });
      queryClient.invalidateQueries({ queryKey: ["operational-request", requestId] });
      queryClient.invalidateQueries({ queryKey: ["operational-projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-operational-requests"] });
      queryClient.invalidateQueries({ queryKey: ["financial-requests"] });
      queryClient.invalidateQueries({ queryKey: ["budget-detail"] });
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

  const isLoading = isLoadingRequest || createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" && "Nuevo Milestone"}
            {mode === "edit" && "Editar Milestone"}
            {mode === "view" && "Detalle del Milestone"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              {...register("name")}
              disabled={isReadOnly}
              placeholder="Nombre del request"
            />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="operational_project_id">Proyecto *</Label>
            <Select
              value={watch("operational_project_id")}
              onValueChange={(value) => setValue("operational_project_id", value)}
              disabled={isReadOnly || !!projectId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar proyecto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.operational_project_id && (
              <p className="text-sm text-destructive mt-1">{errors.operational_project_id.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="client_id">Cliente *</Label>
            <Select
              value={watch("client_id")}
              onValueChange={(value) => setValue("client_id", value)}
              disabled={isReadOnly || !!selectedProject}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.client_id && (
              <p className="text-sm text-destructive mt-1">{errors.client_id.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="financial_request_id">Financial Request (opcional)</Label>
            <Select
              value={watch("financial_request_id") || "none"}
              onValueChange={(value) => setValue("financial_request_id", value === "none" ? "" : value)}
              disabled={isReadOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ninguno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguno</SelectItem>
                {financialRequests.map((req) => (
                  <SelectItem key={req.id} value={req.id}>
                    {req.code} - {req.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assignee_user_id">Asignar Usuario</Label>
              <Select
                value={watch("assignee_user_id") || "none"}
                onValueChange={(value) => setValue("assignee_user_id", value === "none" ? "" : value)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ninguno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
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
                value={watch("assignee_specialist_id") || "none"}
                onValueChange={(value) => setValue("assignee_specialist_id", value === "none" ? "" : value)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ninguno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
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
              <Label htmlFor="reviewer_type">Tipo de Revisor</Label>
              <Select
                value={watch("reviewer_type") || "none"}
                onValueChange={(value) => setValue("reviewer_type", value === "none" ? undefined : value as any)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ninguno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
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
              rows={4}
              placeholder="Descripción detallada del request"
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
