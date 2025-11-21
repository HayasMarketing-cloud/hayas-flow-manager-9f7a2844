import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUserRole, UserRole } from "@/hooks/useUserRole";

interface RoleBasedRouteProps {
  allowedRoles: UserRole[];
  children: ReactNode;
  fallbackPath?: string;
}

export function RoleBasedRoute({ 
  allowedRoles, 
  children, 
  fallbackPath = "/" 
}: RoleBasedRouteProps) {
  const { hasRole, loading } = useUserRole();
  
  const hasAccess = allowedRoles.some(role => hasRole(role));
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Verificando permisos...</div>
      </div>
    );
  }
  
  if (!hasAccess) {
    return <Navigate to={fallbackPath} replace />;
  }
  
  return <>{children}</>;
}
