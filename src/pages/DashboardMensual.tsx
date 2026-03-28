import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DollarSign, TrendingUp, Wallet, ArrowDownUp, ChevronRight, ChevronDown, RefreshCw, Users, UserCheck, Receipt, FileText } from 'lucide-react';
import { useDashboardMensualData, ViewMode, ClientSummary, SpecialistSummary } from '@/hooks/useDashboardMensualData';
import { useUserRole } from '@/hooks/useUserRole';
import { KPICard } from '@/components/dashboard/kpis/KPICard';
import { KPISkeleton } from '@/components/dashboard/kpis/KPISkeleton';
import { formatCurrency } from '@/lib/request-utils';
import { cn } from '@/lib/utils';
import { cn } from '@/lib/utils';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Borrador', variant: 'secondary' },
    sent: { label: 'Enviada', variant: 'outline' },
    paid: { label: 'Cobrada', variant: 'default' },
    overdue: { label: 'Vencida', variant: 'destructive' },
    // Liquidation statuses
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
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell className="font-medium">
            <div className="flex items-center gap-2">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {client.clientName}
            </div>
          </TableCell>
          <TableCell className="text-right font-semibold text-green-700 dark:text-green-400">{formatCurrency(client.revenue)}</TableCell>
          <TableCell className="text-right text-muted-foreground">{formatCurrency(client.commissions)}</TableCell>
          <TableCell className={cn("text-right font-semibold", client.margin >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400")}>{formatCurrency(client.margin)}</TableCell>
          <TableCell className="text-right">{client.marginPercent.toFixed(1)}%</TableCell>
          <TableCell className="text-right">{client.invoices.length}</TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {client.origins.map((origin, idx) => (
          <TableRow key={idx} className="bg-muted/30">
            <TableCell className="pl-10 text-sm">
              <span className="text-muted-foreground">{origin.type === 'contract' ? '📄' : '📋'}</span>{' '}
              <span className="font-medium">{origin.code}</span> — {origin.title}
            </TableCell>
            <TableCell className="text-right text-sm">{formatCurrency(origin.revenue)}</TableCell>
            <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(origin.commissions)}</TableCell>
            <TableCell className="text-right text-sm">{formatCurrency(origin.margin)}</TableCell>
            <TableCell className="text-right text-sm">{origin.revenue > 0 ? ((origin.margin / origin.revenue) * 100).toFixed(1) : '0.0'}%</TableCell>
            <TableCell className="text-right text-sm">{origin.invoices.length}</TableCell>
          </TableRow>
        ))}
        {/* Invoice detail rows */}
        {client.invoices.map(inv => (
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
            <TableCell className="text-right">{getStatusBadge(inv.status)}</TableCell>
          </TableRow>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SpecialistRow({ specialist }: { specialist: SpecialistSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell className="font-medium">
            <div className="flex items-center gap-2">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {specialist.specialistName}
            </div>
          </TableCell>
          <TableCell className="text-right font-semibold">{formatCurrency(specialist.totalCost)}</TableCell>
          <TableCell className="text-right">{specialist.liquidations.length}</TableCell>
          <TableCell />
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {specialist.liquidations.map(liq => (
          <TableRow key={liq.id} className="bg-muted/10">
            <TableCell className="pl-10 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-muted-foreground" />
                {liq.code}
                <span className="text-xs text-muted-foreground">
                  ({MONTHS[liq.period_month - 1]} {liq.period_year})
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right text-sm">{formatCurrency(liq.total_amount)}</TableCell>
            <TableCell className="text-right">
              {getStatusBadge(liq.status)}
            </TableCell>
            <TableCell className="text-right text-xs text-muted-foreground">
              {liq.specialist_invoice_url ? '✅ Factura' : '⏳ Sin factura'}
            </TableCell>
          </TableRow>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function DashboardMensual() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<ViewMode>('cashflow');
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { data, isLoading, refetch } = useDashboardMensualData(year, month, viewMode);
  const navigate = useNavigate();

  if (roleLoading) return null;
  
  if (!isAdmin()) {
    return (
      <AppLayout title="Dashboard" description="Sin acceso">
        <p className="text-muted-foreground">No tienes permisos para ver este dashboard.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Dashboard Mensual"
      description={`${MONTHS[month - 1]} ${year} — Vista ${viewMode === 'cashflow' ? 'Cash-flow' : 'Devengado'}`}
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
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant={viewMode === 'cashflow' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('cashflow')}
                >
                  Cash-flow
                </Button>
                <Button
                  variant={viewMode === 'accrual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('accrual')}
                >
                  Devengado
                </Button>
              </div>

              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <KPISkeleton key={i} />)}
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <KPICard
              title="Cash-flow Neto"
              value={formatCurrency(data.kpis.netCashFlow)}
              subtitle="Ingresos - Liquidaciones"
              icon={ArrowDownUp}
              variant={data.kpis.netCashFlow >= 0 ? 'success' : 'danger'}
            />
          </div>
        ) : null}

        {/* Clients Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Ingresos por Cliente</CardTitle>
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
                    <TableCell className="text-right">{formatCurrency(data.kpis.totalCommissions)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.kpis.totalRevenue - data.kpis.totalCommissions)}</TableCell>
                    <TableCell className="text-right">{data.kpis.totalRevenue > 0 ? (((data.kpis.totalRevenue - data.kpis.totalCommissions) / data.kpis.totalRevenue) * 100).toFixed(1) : '0.0'}%</TableCell>
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
                    <TableHead className="text-right">Liquidaciones</TableHead>
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
                    <TableCell className="text-right">{data.specialists.reduce((sum, s) => sum + s.liquidations.length, 0)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No hay liquidaciones para este período</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
