import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

      // 2. Obtener los financial_requests asociados al presupuesto
      const { data: financialRequests, error: requestsError } = await supabase
        .from('financial_requests')
        .select('id, title, description, client_id, specialist_id')
        .eq('budget_id', projectData.budget_id);

      if (requestsError) throw requestsError;

      // 3. Crear operational_requests (actividades) por cada financial_request
      if (financialRequests && financialRequests.length > 0) {
        const operationalRequests = financialRequests.map((fr) => ({
          operational_project_id: project.id,
          client_id: fr.client_id,
          financial_request_id: fr.id,
          name: fr.title,
          description: fr.description || `Actividad generada desde solicitud financiera`,
          status: 'pending' as const,
          created_by: projectData.created_by,
          assignee_specialist_id: fr.specialist_id || null,
        }));

        const { error: opRequestsError } = await supabase
          .from('operational_requests')
          .insert(operationalRequests);

        if (opRequestsError) throw opRequestsError;

        return {
          project,
          activitiesCreated: operationalRequests.length,
        };
      }

      return {
        project,
        activitiesCreated: 0,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['operational-projects'] });
      queryClient.invalidateQueries({ queryKey: ['operational-requests'] });
      queryClient.invalidateQueries({ queryKey: ['budget-detail'] });
      
      if (result.activitiesCreated > 0) {
        toast.success(
          `Proyecto creado con ${result.activitiesCreated} actividad(es) operativa(s)`
        );
      } else {
        toast.success('Proyecto operativo creado');
      }
    },
    onError: (error: any) => {
      toast.error('Error al crear proyecto: ' + error.message);
    },
  });
};
