import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'admin' | 'finanzas' | 'project_manager' | 'especialista' | 'account_manager';

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
            ['admin', 'finanzas', 'project_manager', 'especialista', 'account_manager'].includes(role)
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
  const isProjectManager = () => hasRole('project_manager');
  const isSpecialist = () => hasRole('especialista');
  const canManageClients = () => canAccessFinance() || isAccountManager();
  
  const canViewAssignedClients = () => isAccountManager();
  const canViewOwnLiquidations = () => isSpecialist();
  
  // Account Manager expanded permissions - can view everything under assigned clients
  const canViewClientBudgets = () => isAccountManager();
  const canViewClientInvoices = () => isAccountManager();
  const canViewClientLiquidations = () => isAccountManager();
  const canViewClientProjects = () => isAccountManager();
  const canViewClientTasks = () => isAccountManager();

  // Helper functions for AM/PM filtering
  // Returns true if user is ONLY AM (without admin/finanzas roles)
  const isOnlyAccountManager = () => isAccountManager() && !isAdmin() && !canAccessFinance();
  
  // Returns true if user is ONLY PM (without admin/finanzas roles)
  const isOnlyProjectManager = () => isProjectManager() && !isAdmin() && !canAccessFinance();
  
  // Returns true if user needs to filter data by assignment (AM or PM without elevated roles)
  const shouldFilterByAssignment = () => {
    const hasElevatedAccess = isAdmin() || canAccessFinance() || isProjectManager();
    const isAmOrPm = isAccountManager() || isProjectManager();
    return isAmOrPm && !hasElevatedAccess;
  };

  return {
    roles,
    loading,
    hasRole,
    isAdmin,
    canAccessFinance,
    canAccessOperations,
    canRead,
    isAccountManager,
    isProjectManager,
    isSpecialist,
    canManageClients,
    canViewAssignedClients,
    canViewOwnLiquidations,
    canViewClientBudgets,
    canViewClientInvoices,
    canViewClientLiquidations,
    canViewClientProjects,
    canViewClientTasks,
    // New helpers for AM/PM filtering
    isOnlyAccountManager,
    isOnlyProjectManager,
    shouldFilterByAssignment,
  };
};
