import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { OverdueRequestsCard } from '@/components/dashboard-admin/OverdueRequestsCard';
import { ApprovedBudgetsWithoutRequestsCard } from '@/components/dashboard-admin/ApprovedBudgetsWithoutRequestsCard';
import { PendingBudgetsCard } from '@/components/dashboard-admin/PendingBudgetsCard';
import { CurrentMonthByClient } from '@/components/dashboard-admin/CurrentMonthByClient';
import {
  useOverdueRequests,
  useApprovedBudgetsWithoutRequests,
  usePendingBudgets,
  useCurrentMonthByClient,
  dashboardAdminPeriod,
} from '@/hooks/useDashboardAdmin';
import { AlertTriangle, FileWarning, Clock, Calendar } from 'lucide-react';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const KpiTile = ({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number | string; tone: 'red' | 'yellow' | 'blue' }) => {
  const colors = {
    red: 'text-destructive',
    yellow: 'text-yellow-600',
    blue: 'text-primary',
  }[tone];
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`h-5 w-5 ${colors}`} />
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function DashboardAdmin() {
  const overdue = useOverdueRequests();
  const orphans = useApprovedBudgetsWithoutRequests();
  const pending = usePendingBudgets();
  const month = useCurrentMonthByClient();

  const monthLabel = `${MONTHS[dashboardAdminPeriod.month - 1]} ${dashboardAdminPeriod.year}`;
  const totalMonthRequests = month.data?.reduce((a, c) => a + c.totalRequests, 0) ?? 0;

  return (
    <AppLayout title="Dashboard Admin" description={`Control operativo — ${monthLabel}`}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon={AlertTriangle} label="Requests atrasados" value={overdue.data?.length ?? '—'} tone="red" />
          <KpiTile icon={FileWarning} label="Presupuestos sin requests" value={orphans.data?.length ?? '—'} tone="red" />
          <KpiTile icon={Clock} label="Presupuestos pendientes" value={pending.data?.length ?? '—'} tone="yellow" />
          <KpiTile icon={Calendar} label="Requests este mes" value={totalMonthRequests} tone="blue" />
        </div>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Alertas críticas</h2>
          <OverdueRequestsCard />
          <ApprovedBudgetsWithoutRequestsCard />
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Seguimiento comercial</h2>
          <PendingBudgetsCard />
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mes en curso</h2>
          <CurrentMonthByClient />
        </section>
      </div>
    </AppLayout>
  );
}
