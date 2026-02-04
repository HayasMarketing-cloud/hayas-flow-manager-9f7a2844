import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { notifyProjectCompleted } from '@/lib/notification-utils';
import { notificationFeedback } from '@/lib/notification-feedback';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from './useUserRole';

export const useOperationalProjects = (filters?: {
  clientId?: string;
  status?: string;
  searchTerm?: string;
  assignedClientIds?: string[];
  needsFiltering?: boolean;
  enabled?: boolean;
}) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['operational-projects', filters, user?.id],
    queryFn: async () => {
      // Select with FK hint for owner (needed because multiple FKs to profiles exist)
      const selectFields = `
        id,
        name,
        description,
        status,
        deadline,
        drive_folder_url,
        hub_client_url,
        hub_project_url,
        client_id,
        contract_id,
        budget_id,
        owner_user_id,
        created_at,
        created_by,
        client:clients(id, name, code, hub_client_url),
        contract:contracts(id, title),
        budget:budgets(id, title),
        owner:profiles!operational_projects_owner_user_id_fkey(id, full_name)
      `;

      let query = supabase
        .from('operational_projects')
        .select(selectFields)
        .order('created_at', { ascending: false });

      // Apply AM/PM client filtering if needed
      if (filters?.needsFiltering && filters.assignedClientIds && filters.assignedClientIds.length > 0) {
        query = query.in('client_id', filters.assignedClientIds);
      }

      // Apply user filters
      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status as any);
      }
      if (filters?.searchTerm) {
        query = query.ilike('name', `%${filters.searchTerm}%`);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching operational projects:', error);
        throw error;
      }

      console.log('Operational projects fetched:', data?.length || 0, 'projects');
      return data || [];
    },
    enabled: filters?.enabled !== false,
  });
};

export const useOperationalProject = (projectId: string | null) => {
  return useQuery({
    queryKey: ['operational-project', projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const { data, error } = await supabase
        .from('operational_projects')
        .select(`
          *,
          client:clients(id, name, code, hub_client_url),
          contract:contracts(id, title, am_user_id, pm_user_id,
            am_profile:profiles!contracts_am_user_id_fkey(id, full_name),
            pm_profile:profiles!contracts_pm_user_id_fkey(id, full_name)
          ),
          budget:budgets(id, title, am_user_id, pm_user_id,
            am_profile:profiles!budgets_am_user_id_fkey(id, full_name),
            pm_profile:profiles!budgets_pm_user_id_fkey(id, full_name)
          ),
          owner:profiles!operational_projects_owner_user_id_fkey(id, full_name)
        `)
        .eq('id', projectId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
};

export const useCreateOperationalProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const { data: project, error } = await supabase
        .from('operational_projects')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational-projects'] });
      toast.success('Proyecto operativo creado');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });
};

export const useUpdateOperationalProject = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      // Get project details before update for notification
      let projectDetails = null;
      if (data.status === 'completed') {
        const { data: project } = await supabase
          .from('operational_projects')
          .select(`
            id,
            name,
            client:clients(id, name)
          `)
          .eq('id', id)
          .single();
        projectDetails = project;
      }

      const { error } = await supabase
        .from('operational_projects')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      
      return { projectDetails, newStatus: data.status };
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['operational-projects'] });
      queryClient.invalidateQueries({ queryKey: ['operational-project'] });
      toast.success('Proyecto actualizado');

      // Send notifications if project was marked as completed
      if (result.newStatus === 'completed' && result.projectDetails) {
        const project = result.projectDetails;
        const clientName = (project.client as any)?.name || 'Cliente';
        
        // In-app notification
        await notifyProjectCompleted(project.name, project.id, clientName);

        // Email notification
        let emailSent = false;
        try {
          const userEmail = user?.email;
          if (userEmail && userEmail.endsWith('@hayas.es')) {
            const appUrl = window.location.origin;
            await supabase.functions.invoke('send-project-completed-notification', {
              body: {
                projectId: project.id,
                senderEmail: userEmail,
                appUrl,
              }
            });
            emailSent = true;
          }
        } catch (emailError) {
          console.error('Error sending project completed email:', emailError);
        }

        // Show notification feedback
        notificationFeedback.projectCompleted(project.name, emailSent);
      }
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });
};

export const useDeleteOperationalProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('operational_projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational-projects'] });
      toast.success('Proyecto eliminado');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });
};

// Hook to update a single field on a project (for inline editing)
export const useUpdateProjectField = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      field, 
      value 
    }: { 
      projectId: string; 
      field: 'status' | 'deadline'; 
      value: string | null;
    }) => {
      const { error } = await supabase
        .from('operational_projects')
        .update({ [field]: value })
        .eq('id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational-projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-milestones'] });
      toast.success('Proyecto actualizado');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });
};
