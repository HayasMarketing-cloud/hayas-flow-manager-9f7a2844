import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TemplateStructure {
  milestones: Array<{
    name: string;
    tasks: string[];
  }>;
}

interface CreateProjectWithActivitiesParams {
  projectData: {
    name: string;
    client_id: string;
    budget_id: string;
    description?: string | null;
    deadline?: string | null;
    status?: 'pending' | 'in_progress' | 'in_review' | 'completed';
    hub_project_url?: string | null;
    owner_user_id?: string | null;
    created_by: string;
  };
}

export const useCreateProjectWithActivities = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectData }: CreateProjectWithActivitiesParams) => {
      // 1. Crear el proyecto operativo
      const { data: project, error: projectError } = await supabase
        .from('operational_projects')
        .insert(projectData)
        .select()
        .single();

      if (projectError) throw projectError;

      // 2. Obtener los financial_requests asociados al presupuesto con info del servicio
      const { data: financialRequests, error: requestsError } = await supabase
        .from('financial_requests')
        .select(`
          id, 
          title, 
          description, 
          client_id, 
          specialist_id,
          service_id,
          service:services(id, name, template_structure)
        `)
        .eq('budget_id', projectData.budget_id);

      if (requestsError) throw requestsError;

      if (!financialRequests || financialRequests.length === 0) {
        return {
          project,
          activitiesCreated: 0,
          tasksCreated: 0,
        };
      }

      let totalMilestones = 0;
      let totalTasks = 0;

      // 3. Para cada financial_request, decidir si clonar desde plantilla o crear milestone simple
      for (const fr of financialRequests) {
        const service = fr.service as unknown as { id: string; name: string; template_structure: TemplateStructure | null } | null;
        const templateStructure = service?.template_structure;

        if (templateStructure && templateStructure.milestones && templateStructure.milestones.length > 0) {
          // CASO A: Servicio tiene plantilla → clonar milestones y tareas
          for (const milestoneTemplate of templateStructure.milestones) {
            // Crear operational_request (milestone) desde plantilla
            const { data: opRequest, error: opReqError } = await supabase
              .from('operational_requests')
              .insert({
                operational_project_id: project.id,
                client_id: fr.client_id,
                financial_request_id: fr.id,
                name: milestoneTemplate.name,
                description: `Milestone de ${fr.title}`,
                status: 'pending' as const,
                created_by: projectData.created_by,
                assignee_specialist_id: fr.specialist_id || null,
              })
              .select('id')
              .single();

            if (opReqError) throw opReqError;
            totalMilestones++;

            // Crear tareas desde plantilla
            if (milestoneTemplate.tasks && milestoneTemplate.tasks.length > 0) {
              const tasksToInsert = milestoneTemplate.tasks.map((taskName, index) => ({
                operational_request_id: opRequest.id,
                name: taskName,
                status: 'pending' as const,
                order_index: index,
                assignee_specialist_id: fr.specialist_id || null,
              }));

              const { error: tasksError } = await supabase
                .from('tasks')
                .insert(tasksToInsert);

              if (tasksError) throw tasksError;
              totalTasks += tasksToInsert.length;
            }
          }
        } else {
          // CASO B: Sin plantilla → crear 1 milestone simple desde el request
          const { error: opReqError } = await supabase
            .from('operational_requests')
            .insert({
              operational_project_id: project.id,
              client_id: fr.client_id,
              financial_request_id: fr.id,
              name: fr.title,
              description: fr.description || `Actividad generada desde solicitud financiera`,
              status: 'pending' as const,
              created_by: projectData.created_by,
              assignee_specialist_id: fr.specialist_id || null,
            });

          if (opReqError) throw opReqError;
          totalMilestones++;
        }
      }

      return {
        project,
        activitiesCreated: totalMilestones,
        tasksCreated: totalTasks,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['operational-projects'] });
      queryClient.invalidateQueries({ queryKey: ['operational-requests'] });
      queryClient.invalidateQueries({ queryKey: ['budget-detail'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      let message = `Proyecto creado con ${result.activitiesCreated} milestone(s)`;
      if (result.tasksCreated > 0) {
        message += ` y ${result.tasksCreated} tarea(s)`;
      }
      toast.success(message);
    },
    onError: (error: any) => {
      toast.error('Error al crear proyecto: ' + error.message);
    },
  });
};
