import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { DollarSign, TrendingUp, Wallet, ChevronRight, ChevronDown, Users, UserCheck, Receipt, Lock, LockOpen, AlertTriangle, CheckCircle2, Loader2, FileWarning, LinkIcon, FileX } from 'lucide-react';
import { useDashboardMensualData, ViewMode, ClientSummary, SpecialistSummary } from '@/hooks/useDashboardMensualData';
import { useClosedMonths, useIsMonthClosed, useValidateMonthClosure, useCloseMonth, useReopenMonth, getDefaultMonth } from '@/hooks/useClosedMonths';
import { useDashboardAlerts } from '@/hooks/useDashboardAlerts';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { KPICard } from '@/components/dashboard/kpis/KPICard';
import { KPISkeleton } from '@/components/dashboard/kpis/KPISkeleton';
import { AlertsWidget } from '@/components/dashboard/widgets/AlertsWidget';
import { CompletedProjectsWidget } from '@/components/dashboard/widgets/CompletedProjectsWidget';
import { formatCurrency } from '@/lib/request-utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const getStatusBadge = (status: string, context: 'invoice' | 'liquidation' = 'invoice') => {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Borrador', variant: 'secondary' },
    sent: { label: 'Enviada', variant: 'outline' },
    paid: { label: context === 'liquidation' ? 'Pagada' : 'Cobrada', variant: 'default' },
    overdue: { label: 'Vencida', variant: 'destructive' },
    pending_payment: { label: 'Pend. Pago', variant: 'outline' },
    accepted: { label: 'Aceptada', variant: 'outline' },
    validated: { label: 'Validada', variant: 'outline' },
    invoice_received: { label: 'Factura recibida', variant: 'outline' },
    disputed: { label: 'Disputada', variant: 'destructive' },
  };
  const item = map[status] || { label: status, variant: 'secondary' as const };
  return <Badge variant={item.variant} className="text-xs">{item.label}</Badge>;
};

function ClientRow({ client }: { client: ClientSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setOpen(!open)}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {client.clientName}
          </div>
        </TableCell>
        <TableCell className="text-right font-semibold text-green-700 dark:text-green-400">{formatCurrency(client.revenue)}</TableCell>
        <TableCell className="text-right text-red-600 dark:text-red-400">{formatCurrency(client.costs)}</TableCell>
        <TableCell className="text-right text-muted-foreground">{formatCurrency(client.commissions)}</TableCell>
        <TableCell className={cn("text-right font-semibold", client.margin >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400")}>{formatCurrency(client.margin)}</TableCell>
        <TableCell className="text-right">{client.marginPercent.toFixed(1)}%</TableCell>
        <TableCell className="text-right">{client.invoices.length}</TableCell>
      </TableRow>
      {open && client.origins.map((origin, idx) => (
        <TableRow key={idx} className="bg-muted/30">
          <TableCell className="pl-10 text-sm">
            <span className="text-muted-foreground">{origin.type === 'contract' ? '📄' : '📋'}</span>{' '}
            <span className="font-medium">{origin.code}</span> — {origin.title}
          </TableCell>
          <TableCell className="text-right text-sm">{formatCurrency(origin.revenue)}</TableCell>
          <TableCell className="text-right text-sm">{formatCurrency(origin.costs)}</TableCell>
          <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(origin.commissions)}</TableCell>
          <TableCell className="text-right text-sm">{formatCurrency(origin.margin)}</TableCell>
          <TableCell className="text-right text-sm">{origin.revenue > 0 ? ((origin.margin / origin.revenue) * 100).toFixed(1) : '0.0'}%</TableCell>
          <TableCell className="text-right text-sm">{origin.invoices.length}</TableCell>
        </TableRow>
      ))}
      {open && client.invoices.map(inv => (
        <TableRow key={inv.id} className="bg-muted/10">
          <TableCell className="pl-14 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Receipt className="h-3 w-3" />
              {inv.code}
            </div>
          </TableCell>
          <TableCell className="text-right text-xs">{formatCurrency(inv.subtotal)}</TableCell>
          <TableCell />
          <TableCell />
          <TableCell />
          <TableCell />
          <TableCell className="text-right">{getStatusBadge(inv.status)}</TableCell>
        </TableRow>
      ))}
    </>
  );
}

function SpecialistRow({ specialist }: { specialist: SpecialistSummary }) {
  const navigate = useNavigate();
  const liq = specialist.liquidations[0];

  return (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => liq && navigate(`/liquidaciones/${liq.id}`)}
    >
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {specialist.specialistName}
          {liq && (
            <span className="text-xs text-muted-foreground">({liq.code})</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right font-semibold">{formatCurrency(specialist.totalCost)}</TableCell>
      <TableCell className="text-right">
        {liq ? getStatusBadge(liq.status, 'liquidation') : '—'}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">
        {liq ? (liq.specialist_invoice_url ? '✅ Factura' : '⏳ Sin factura') : '—'}
      </TableCell>
    </TableRow>
  );
}

function ReconciliationSection({ data, month, year }: { data: { requestsWithoutInvoice: number; requestsWithoutLiquidation: number; requestsWithoutOrigin: number; invoicesWithoutPeriod: number }; month: number; year: number }) {
  const navigate = useNavigate();
  const total = data.requestsWithoutInvoice + data.requestsWithoutLiquidation + data.requestsWithoutOrigin + data.invoicesWithoutPeriod;

  if (total === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Estado del Cierre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">✅ Todas las solicitudes de {MONTHS[month - 1]} están correctamente asociadas</p>
        </CardContent>
      </Card>
    );
  }

  const items = [
    {
      icon: FileX,
      label: 'Sin factura de cliente',
      count: data.requestsWithoutInvoice,
      variant: 'destructive' as const,
      onClick: () => navigate(`/solicitudes?work_month=${month}&work_year=${year}`),
    },
    {
      icon: FileWarning,
      label: 'Sin liquidación',
      count: data.requestsWithoutLiquidation,
      variant: 'default' as const,
      onClick: () => navigate(`/solicitudes?work_month=${month}&work_year=${year}`),
    },
    {
      icon: LinkIcon,
      label: 'Sin origen económico',
      count: data.requestsWithoutOrigin,
      variant: 'secondary' as const,
      onClick: () => navigate(`/solicitudes?work_month=${month}&work_year=${year}`),
    },
    {
      icon: Receipt,
      label: 'Facturas sin periodo asignado',
      count: data.invoicesWithoutPeriod,
      variant: 'destructive' as const,
      onClick: () => navigate(`/facturas`),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Estado del Cierre — {MONTHS[month - 1]} {year}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              disabled={item.count === 0}
              className={cn(
                "flex items-center gap-3 p-4 rounded-lg border text-left transition-colors",
                item.count > 0 ? "hover:bg-muted/50 cursor-pointer" : "opacity-50 cursor-default"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", item.count > 0 ? "text-amber-500" : "text-green-500")} />
              <div>
                <p className="text-2xl font-bold">{item.count}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardMensual() {
  const now = new Date();
  const navigate = useNavigate();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const viewMode: ViewMode = 'accrual';
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [defaultApplied, setDefaultApplied] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { user } = useAuth();
  const { data, isLoading } = useDashboardMensualData(year, month, viewMode);
  const { data: closedMonths, isLoading: loadingClosed } = useClosedMonths();
  const isClosed = useIsMonthClosed(year, month);
  const { data: validation, isLoading: validating } = useValidateMonthClosure(year, month);
  const closeMutation = useCloseMonth();
  const reopenMutation = useReopenMonth();
  const { data: alerts, isLoading: alertsLoading } = useDashboardAlerts();

  useEffect(() => {
    if (!loadingClosed && closedMonths && !defaultApplied) {
      const def = getDefaultMonth(closedMonths);
      setYear(def.year);
      setMonth(def.month);
      setDefaultApplied(true);
    }
  }, [loadingClosed, closedMonths, defaultApplied]);

  if (roleLoading) return null;
  
  if (!isAdmin()) {
    return (
      <AppLayout title="Dashboard" description="Sin acceso">
        <p className="text-muted-foreground">No tienes permisos para ver este dashboard.</p>
      </AppLayout>
    );
  }

  const handleCloseMonth = () => {
    if (!user?.id) return;
    closeMutation.mutate({ year, month, userId: user.id }, {
      onSuccess: () => {
        toast.success(`${MONTHS[month - 1]} ${year} cerrado correctamente`);
        setShowCloseDialog(false);
      },
      onError: (err: Error) => toast.error(`Error: ${err.message}`),
    });
  };

  const handleReopenMonth = () => {
    reopenMutation.mutate({ year, month }, {
      onSuccess: () => toast.success(`${MONTHS[month - 1]} ${year} reabierto`),
      onError: (err: Error) => toast.error(`Error: ${err.message}`),
    });
  };

  const totalClientCosts = data?.clients.reduce((sum, c) => sum + c.costs, 0) || 0;

  return (
    <AppLayout
      title="Dashboard Mensual"
      description={`Trabajo de ${MONTHS[month - 1]} ${year} — Vista Devengado (todas las facturas del periodo)`}
    >
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-2 items-center flex-wrap">
                <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => {
                      const monthClosed = closedMonths?.some(cm => cm.year === year && cm.month === i + 1);
                      return (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          <span className="flex items-center gap-2">
                            {m}
                            {monthClosed && <Lock className="h-3 w-3 text-muted-foreground" />}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {isClosed && (
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Mes cerrado
                  </Badge>
                )}

              </div>

              <div className="flex gap-2">
                {isClosed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReopenMonth}
                    disabled={reopenMutation.isPending}
                    className="gap-1"
                  >
                    {reopenMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />}
                    Reabrir mes
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowCloseDialog(true)}
                    className="gap-1"
                  >
                    <Lock className="h-4 w-4" />
                    Cerrar mes
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Close Month Dialog */}
        <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Cerrar {MONTHS[month - 1]} {year}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {validating ? (
                <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Validando...
                </div>
              ) : validation?.canClose ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <p className="text-sm">Todas las facturas están cobradas y todas las liquidaciones pagadas. El mes puede cerrarse.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">No se puede cerrar el mes. Hay elementos pendientes:</p>
                      <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
                        {validation?.issues.map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Cancelar</Button>
              <Button
                onClick={handleCloseMonth}
                disabled={!validation?.canClose || closeMutation.isPending}
              >
                {closeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar cierre
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* KPIs */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <KPISkeleton key={i} />)}
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
              title="Ingresos"
              value={formatCurrency(data.kpis.totalRevenue)}
              icon={DollarSign}
              variant="default"
            />
            <KPICard
              title="Costes Totales"
              value={formatCurrency(data.kpis.totalCosts)}
              subtitle={`Liquidaciones: ${formatCurrency(data.kpis.totalCosts - data.kpis.totalCommissions)} | Comisiones: ${formatCurrency(data.kpis.totalCommissions)}`}
              icon={Wallet}
              variant="default"
            />
            <KPICard
              title="Margen Bruto"
              value={`${data.kpis.grossMarginPercent.toFixed(1)}%`}
              subtitle={formatCurrency(data.kpis.grossMargin)}
              icon={TrendingUp}
              variant={data.kpis.grossMarginPercent >= 30 ? 'success' : data.kpis.grossMarginPercent >= 20 ? 'warning' : 'danger'}
            />
          </div>
        ) : null}

        {/* Reconciliation */}
        {data && (
          <ReconciliationSection data={data.reconciliation} month={month} year={year} />
        )}

        {/* Clients Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">P&L por Cliente</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : data && data.clients.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                    <TableHead className="text-right">Costes Esp.</TableHead>
                    <TableHead className="text-right">Comisiones</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Facturas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.clients.map(client => (
                    <ClientRow key={client.clientId} client={client} />
                  ))}
                  {/* Totals */}
                  <TableRow className="border-t-2 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.kpis.totalRevenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalClientCosts)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.kpis.totalCommissions)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.kpis.totalRevenue - totalClientCosts - data.kpis.totalCommissions)}</TableCell>
                    <TableCell className="text-right">{data.kpis.totalRevenue > 0 ? (((data.kpis.totalRevenue - totalClientCosts - data.kpis.totalCommissions) / data.kpis.totalRevenue) * 100).toFixed(1) : '0.0'}%</TableCell>
                    <TableCell className="text-right">{data.clients.reduce((sum, c) => sum + c.invoices.length, 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No hay facturas para este período</p>
            )}
          </CardContent>
        </Card>

        {/* Specialists Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Costes por Especialista</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : data && data.specialists.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Especialista</TableHead>
                    <TableHead className="text-right">Coste Total</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                    <TableHead className="text-right">Factura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.specialists.map(spec => (
                    <SpecialistRow key={spec.specialistId} specialist={spec} />
                  ))}
                  {/* Total */}
                  <TableRow className="border-t-2 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.specialists.reduce((sum, s) => sum + s.totalCost, 0))}</TableCell>
                    <TableCell />
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No hay liquidaciones para este período</p>
            )}
          </CardContent>
        </Card>

        {/* Collapsible Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Collapsible open={showProjects} onOpenChange={setShowProjects}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-4 py-3 h-auto">
                <span className="font-semibold text-sm">Proyectos completados pend. facturar</span>
                {showProjects ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CompletedProjectsWidget />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={showAlerts} onOpenChange={setShowAlerts}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-4 py-3 h-auto">
                <span className="font-semibold text-sm flex items-center gap-2">
                  Alertas
                  {alerts && alerts.length > 0 && (
                    <Badge variant="destructive" className="text-xs">{alerts.length}</Badge>
                  )}
                </span>
                {showAlerts ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <AlertsWidget alerts={alerts} isLoading={alertsLoading} />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </AppLayout>
  );
}
