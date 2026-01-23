import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

      // 2. Fetch financial_requests linked to this contract
      const { data: financialRequests, error: requestsError } = await supabase
        .from('financial_requests')
        .select('id, title, description, deadline, specialist_id')
        .eq('contract_id', projectData.contract_id);

      if (requestsError) throw requestsError;

      // 3. Create operational_requests (milestones) for each financial_request
      if (financialRequests && financialRequests.length > 0) {
        const operationalRequests = financialRequests.map((fr) => ({
          operational_project_id: project.id,
          client_id: projectData.client_id,
          financial_request_id: fr.id,
          name: fr.title,
          description: fr.description,
          deadline: fr.deadline,
          assignee_specialist_id: fr.specialist_id,
          status: 'pending' as const,
          created_by: projectData.created_by,
        }));

        const { error: milestonesError } = await supabase
          .from('operational_requests')
          .insert(operationalRequests);

        if (milestonesError) throw milestonesError;
      }

      return {
        project,
        milestonesCount: financialRequests?.length || 0,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['operational-projects'] });
      queryClient.invalidateQueries({ queryKey: ['operational-requests'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-operational-project'] });
      toast.success(
        `Proyecto creado con ${data.milestonesCount} ${data.milestonesCount === 1 ? 'milestone' : 'milestones'}`
      );
    },
    onError: (error: any) => {
      toast.error(`Error al crear proyecto: ${error.message}`);
    },
  });
};
