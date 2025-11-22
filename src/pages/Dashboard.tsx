import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";

export default function Dashboard() {
  const navigate = useNavigate();
  const { canAccessFinance, isSpecialist, loading } = useUserRole();

  useEffect(() => {
    if (loading) return;

    // Redirect based on role
    if (canAccessFinance()) {
      navigate("/dashboard-mensual", { replace: true });
    } else if (isSpecialist()) {
      navigate("/dashboard-especialista", { replace: true });
    } else {
      navigate("/dashboard-mensual", { replace: true });
    }
  }, [navigate, canAccessFinance, isSpecialist, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Cargando dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
