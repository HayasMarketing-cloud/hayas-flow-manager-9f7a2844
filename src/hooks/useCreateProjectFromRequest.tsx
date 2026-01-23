import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateProjectFromRequestParams {
  projectData: {
    name: string;
    client_id: string;
    contract_id?: string | null;
    budget_id?: string | null;
    description?: string | null;
    deadline?: string | null;
    status?: 'pending' | 'in_progress' | 'in_review' | 'completed';
    owner_user_id?: string | null;
    created_by: string;
  };
  financialRequest: {
    id: string;
    title: string;
    description?: string | null;
    deadline?: string | null;
    specialist_id?: string | null;
  };
}

export const useCreateProjectFromRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectData, financialRequest }: CreateProjectFromRequestParams) => {
      // 1. Create the operational project
      const { data: project, error: projectError } = await supabase
        .from('operational_projects')
        .insert({
          name: projectData.name,
          client_id: projectData.client_id,
          contract_id: projectData.contract_id,
          budget_id: projectData.budget_id,
          description: projectData.description,
          deadline: projectData.deadline,
          status: projectData.status || 'pending',
          owner_user_id: projectData.owner_user_id,
          created_by: projectData.created_by,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // 2. Create a single operational_request (milestone) for this financial_request
      const { error: milestoneError } = await supabase
        .from('operational_requests')
        .insert({
          operational_project_id: project.id,
          client_id: projectData.client_id,
          financial_request_id: financialRequest.id,
          name: financialRequest.title,
          description: financialRequest.description,
          deadline: financialRequest.deadline,
          assignee_specialist_id: financialRequest.specialist_id,
          status: 'pending' as const,
          created_by: projectData.created_by,
        });

      if (milestoneError) throw milestoneError;

      return { project };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational-projects'] });
      queryClient.invalidateQueries({ queryKey: ['operational-requests'] });
      queryClient.invalidateQueries({ queryKey: ['financial_request'] });
      queryClient.invalidateQueries({ queryKey: ['request-operational-project'] });
      toast.success('Proyecto creado con 1 milestone');
    },
    onError: (error: any) => {
      toast.error(`Error al crear proyecto: ${error.message}`);
    },
  });
};
