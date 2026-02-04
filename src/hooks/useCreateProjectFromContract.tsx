import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TemplateStructure {
  milestones: Array<{
    name: string;
    tasks: string[];
  }>;
}

interface CreateProjectFromContractParams {
  projectData: {
    name: string;
    client_id: string;
    contract_id: string;
    description?: string | null;
    deadline?: string | null;
    status?: 'pending' | 'in_progress' | 'in_review' | 'completed';
    owner_user_id?: string | null;
    created_by: string;
    hub_client_url?: string | null;
    hub_project_url?: string | null;
    drive_folder_url?: string | null;
  };
}

export const useCreateProjectFromContract = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectData }: CreateProjectFromContractParams) => {
      // 1. Create the operational project
      const { data: project, error: projectError } = await supabase
        .from('operational_projects')
        .insert({
          name: projectData.name,
          client_id: projectData.client_id,
          contract_id: projectData.contract_id,
          description: projectData.description,
          deadline: projectData.deadline,
          status: projectData.status || 'pending',
          owner_user_id: projectData.owner_user_id,
          created_by: projectData.created_by,
          hub_client_url: projectData.hub_client_url,
          hub_project_url: projectData.hub_project_url,
          drive_folder_url: projectData.drive_folder_url,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // 2. Fetch financial_requests with service template info
      const { data: financialRequests, error: requestsError } = await supabase
        .from('financial_requests')
        .select(`
          id, 
          title, 
          description, 
          deadline,
          client_id,
          specialist_id,
          service_id,
          service:services(id, name, template_structure)
        `)
        .eq('contract_id', projectData.contract_id);

      if (requestsError) throw requestsError;

      if (!financialRequests || financialRequests.length === 0) {
        return {
          project,
          milestonesCount: 0,
          tasksCount: 0,
        };
      }

      let totalMilestones = 0;
      let totalTasks = 0;

      // 3. For each financial_request, decide whether to clone from template or create simple milestone
      for (const fr of financialRequests) {
        const service = fr.service as unknown as { id: string; name: string; template_structure: TemplateStructure | null } | null;
        const templateStructure = service?.template_structure;

        if (templateStructure && templateStructure.milestones && templateStructure.milestones.length > 0) {
          // CASE A: Service has template → clone milestones and tasks
          for (const milestoneTemplate of templateStructure.milestones) {
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
                deadline: fr.deadline,
              })
              .select('id')
              .single();

            if (opReqError) throw opReqError;
            totalMilestones++;

            // Create tasks from template
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
          // CASE B: No template → create 1 simple milestone from request
          const { error: opReqError } = await supabase
            .from('operational_requests')
            .insert({
              operational_project_id: project.id,
              client_id: fr.client_id,
              financial_request_id: fr.id,
              name: fr.title,
              description: fr.description || `Milestone generado desde solicitud financiera`,
              status: 'pending' as const,
              created_by: projectData.created_by,
              assignee_specialist_id: fr.specialist_id || null,
              deadline: fr.deadline,
            });

          if (opReqError) throw opReqError;
          totalMilestones++;
        }
      }

      return {
        project,
        milestonesCount: totalMilestones,
        tasksCount: totalTasks,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['operational-projects'] });
      queryClient.invalidateQueries({ queryKey: ['operational-requests'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-operational-project'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      let message = `Proyecto creado con ${data.milestonesCount} ${data.milestonesCount === 1 ? 'milestone' : 'milestones'}`;
      if (data.tasksCount > 0) {
        message += ` y ${data.tasksCount} tarea(s)`;
      }
      toast.success(message);
    },
    onError: (error: any) => {
      toast.error(`Error al crear proyecto: ${error.message}`);
    },
  });
};
