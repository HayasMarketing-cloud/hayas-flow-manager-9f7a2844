import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Wallet, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { KPICard } from '@/components/dashboard/kpis/KPICard';
import { KPISkeleton } from '@/components/dashboard/kpis/KPISkeleton';
import { formatCurrency } from '@/lib/request-utils';
import { useNavigate } from 'react-router-dom';

export default function DashboardEspecialista() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get current specialist
  const { data: specialist, isLoading: specialistLoading } = useQuery({
    queryKey: ['current-specialist', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get specialist stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['specialist-stats', specialist?.id],
    queryFn: async () => {
      if (!specialist?.id) return null;

      // Active requests
      const { data: requests } = await supabase
        .from('financial_requests')
        .select('id, cost_to_agency')
        .eq('specialist_id', specialist.id)
        .in('status', ['pending_specialist', 'pending_approval', 'in_progress', 'pending_review']);

      // Pending liquidations
      const { data: liquidations } = await supabase
        .from('liquidations')
        .select('id, total_amount, status')
        .eq('specialist_id', specialist.id)
        .in('status', ['draft', 'sent']);

      // This month's income (liquidations paid)
      const now = new Date();
      const { data: monthlyIncome } = await supabase
        .from('liquidations')
        .select('total_amount')
        .eq('specialist_id', specialist.id)
        .eq('status', 'paid')
        .eq('period_year', now.getFullYear())
        .eq('period_month', now.getMonth() + 1);

      return {
        activeRequests: requests?.length || 0,
        pendingLiquidations: {
          count: liquidations?.length || 0,
          amount: liquidations?.reduce((sum, liq) => sum + liq.total_amount, 0) || 0,
        },
        monthlyIncome: monthlyIncome?.reduce((sum, liq) => sum + liq.total_amount, 0) || 0,
      };
    },
    enabled: !!specialist?.id,
  });

  if (specialistLoading) {
    return (
      <AppLayout title="Mi Dashboard">
        <div className="flex justify-center py-8">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </AppLayout>
    );
  }

  if (!specialist) {
    return (
      <AppLayout title="Mi Dashboard">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <p className="text-destructive">No se encontró un perfil de especialista asociado</p>
              <p className="text-sm text-muted-foreground">
                Contacta con un administrador para que te asigne un perfil de especialista
              </p>
            </div>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      title="Mi Dashboard" 
      description={`Especialista: ${specialist.name}`}
    >
      <div className="space-y-6">
        {/* KPIs Grid */}
        {statsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <KPISkeleton key={i} />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
              title="Requests Activos"
              value={stats.activeRequests}
              subtitle="Asignados a mí"
              icon={FileText}
              variant="default"
              onClick={() => navigate('/solicitudes')}
            />

            <KPICard
              title="Liquidaciones Pendientes"
              value={stats.pendingLiquidations.count}
              subtitle={formatCurrency(stats.pendingLiquidations.amount)}
              icon={Clock}
              variant={stats.pendingLiquidations.count > 0 ? 'warning' : 'success'}
              onClick={() => navigate('/mis-liquidaciones')}
            />

            <KPICard
              title="Ingresos Este Mes"
              value={formatCurrency(stats.monthlyIncome)}
              subtitle="Liquidaciones pagadas"
              icon={Wallet}
              variant="success"
              onClick={() => navigate('/mis-liquidaciones')}
            />
          </div>
        ) : null}

        {/* Quick Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Accesos rápidos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate('/solicitudes')}
                    className="text-left p-3 rounded-lg border hover:bg-muted transition-colors"
                  >
                    <div className="font-medium">Mis Solicitudes</div>
                    <div className="text-sm text-muted-foreground">Ver requests asignados</div>
                  </button>
                  <button
                    onClick={() => navigate('/mis-liquidaciones')}
                    className="text-left p-3 rounded-lg border hover:bg-muted transition-colors"
                  >
                    <div className="font-medium">Mis Liquidaciones</div>
                    <div className="text-sm text-muted-foreground">Ver historial de pagos</div>
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
