import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useOperationalProjects = (filters?: {
  clientId?: string;
  status?: string;
  searchTerm?: string;
}) => {
  return useQuery({
    queryKey: ['operational-projects', filters],
    queryFn: async () => {
      let query = supabase
        .from('operational_projects')
        .select(`
          *,
          client:clients(id, name, code),
          contract:contracts(id, title),
          budget:budgets(id, title),
          owner:profiles!operational_projects_owner_user_id_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false });

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
      if (error) throw error;
      return data;
    },
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
          client:clients(id, name, code),
          contract:contracts(id, title),
          budget:budgets(id, title),
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

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('operational_projects')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational-projects'] });
      queryClient.invalidateQueries({ queryKey: ['operational-project'] });
      toast.success('Proyecto actualizado');
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
