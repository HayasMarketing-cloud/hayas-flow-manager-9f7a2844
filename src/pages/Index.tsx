import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      // Redirigir automáticamente según estado de autenticación
      navigate(user ? '/dashboard-mensual' : '/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  // Mostrar loading mientras se verifica autenticación
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
};

export default Index;
