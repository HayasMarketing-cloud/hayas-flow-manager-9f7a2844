import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentSpecialist } from "@/hooks/useCurrentSpecialist";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCheck, ArrowRight, Loader2 } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { canAccessFinance, isSpecialist, isProjectManager, isAccountManager, isAdmin, loading } = useUserRole();
  const { specialist, specialistId, isLoading: specialistLoading } = useCurrentSpecialist();

  // Count active requests assigned to this specialist
  const { data: myRequestsCount } = useQuery({
    queryKey: ['my-specialist-requests-count', specialistId],
    queryFn: async () => {
      if (!specialistId) return 0;
      const { count, error } = await supabase
        .from('financial_requests')
        .select('*', { count: 'exact', head: true })
        .eq('specialist_id', specialistId)
        .not('status', 'in', '("completed","cancelled")');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!specialistId,
  });

  const isPureSpecialist = isSpecialist() && !isProjectManager() && !isAccountManager() && !isAdmin() && !canAccessFinance();

  useEffect(() => {
    if (loading) return;

    // Pure specialists go directly to specialist dashboard
    if (isPureSpecialist) {
      navigate("/dashboard-especialista", { replace: true });
      return;
    }

    // Users with finance access go to finance dashboard
    if (canAccessFinance()) {
      navigate("/dashboard-mensual", { replace: true });
    } else if (!isSpecialist()) {
      // Non-specialist PMs/AMs go to monthly dashboard
      navigate("/dashboard-mensual", { replace: true });
    }
    // Dual-role users (PM/AM + especialista) stay here to see the widget
  }, [navigate, canAccessFinance, isSpecialist, isPureSpecialist, loading]);

  if (loading || specialistLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show specialist widget for dual-role users (PM/AM + especialista)
  const showSpecialistWidget = isSpecialist() && !isPureSpecialist;

  if (showSpecialistWidget) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-md px-4">
          <Card className="border-2 border-primary/20 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Mis Requests como Especialista</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {specialist?.name ?? 'Especialista'}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Requests activos asignados</span>
                <Badge variant="secondary" className="text-base font-semibold px-3 py-1">
                  {myRequestsCount ?? 0}
                </Badge>
              </div>
              <div className="flex flex-col gap-2">
                <Button asChild className="w-full">
                  <Link to="/dashboard-especialista">
                    Ver mi Dashboard Especialista
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/dashboard-mensual">
                    Ir al Dashboard General
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
