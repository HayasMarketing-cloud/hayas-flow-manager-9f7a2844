import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'admin' | 'finanzas' | 'project_manager' | 'especialista' | 'account_manager' | 'seller';

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      // Wait for auth to finish loading
      if (authLoading) {
        return;
      }

      if (!user) {
        setRoles([]);
        setRolesLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching user roles:', error);
          setRoles([]);
        } else {
          const validRoles = data?.map(r => r.role).filter((role: string): role is UserRole => 
            ['admin', 'finanzas', 'project_manager', 'especialista', 'account_manager', 'seller'].includes(role)
          ) || [];
          setRoles(validRoles);
        }
      } catch (error) {
        console.error('Error fetching user roles:', error);
        setRoles([]);
      } finally {
        setRolesLoading(false);
      }
    };

    fetchRoles();
  }, [user, authLoading]);

  // Combined loading state
  const loading = authLoading || rolesLoading;

  const hasRole = (role: UserRole) => roles.includes(role);
  const isAdmin = () => hasRole('admin');
  const canAccessFinance = () => hasRole('admin') || hasRole('finanzas');
  const canAccessOperations = () => hasRole('admin') || hasRole('project_manager');
  const canRead = () => roles.length > 0;
  const isAccountManager = () => hasRole('account_manager');
  const isSeller = () => hasRole('seller');
  const isProjectManager = () => hasRole('project_manager');
  const isSpecialist = () => hasRole('especialista');
  const canManageClients = () => canAccessFinance() || isAccountManager() || isSeller();
  
  // New permission helpers
  const canViewOwnInvoices = () => isSeller();
  const canViewAssignedClients = () => isAccountManager();
  const canViewOwnLiquidations = () => isSpecialist();

  return {
    roles,
    loading,
    hasRole,
    isAdmin,
    canAccessFinance,
    canAccessOperations,
    canRead,
    isAccountManager,
    isSeller,
    isProjectManager,
    isSpecialist,
    canManageClients,
    canViewOwnInvoices,
    canViewAssignedClients,
    canViewOwnLiquidations,
  };
};
