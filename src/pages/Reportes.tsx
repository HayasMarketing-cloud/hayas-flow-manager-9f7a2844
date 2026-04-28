import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Download, FileBarChart, TrendingUp, Users, DollarSign, Receipt, Wallet, FolderKanban, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { downloadExcel, formatCurrency } from '@/utils/excel/excelExporter';
import { Skeleton } from '@/components/ui/skeleton';
import { useConsolidatedPnL } from '@/hooks/useEntityPnL';
import { Badge } from '@/components/ui/badge';
import { useIrpfQuarterly } from '@/hooks/useIrpfQuarterly';

type ReportType = 'revenue_vs_costs' | 'margin_by_client' | 'liquidations_by_specialist' | 'requests_summary' | 'pnl_by_project' | 'irpf_quarterly';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_NAMES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const QUARTER_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  closed: { label: 'Cerrado', className: 'bg-green-100 text-green-700 border-green-300' },
  pending_payment: { label: 'Pendiente liquidar a Hacienda', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  in_progress: { label: 'En curso', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  forecast: { label: 'Previsión', className: 'bg-muted text-muted-foreground border-border' },
};

export default function Reportes() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('revenue_vs_costs');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);

  // Query for detailed monthly data when month is selected
  const { data: monthlyDetails, isLoading: loadingMonthlyDetails } = useQuery({
    queryKey: ['monthly-report-details', year, month],
    queryFn: async () => {
      if (!month) return null;

      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      // Get invoices with client info and items
      const { data: invoices } = await supabase
        .from('invoices')
        .select(`
          id,
          code,
          invoice_date,
          subtotal,
          total_amount,
          status,
          client:clients(id, name)
        `)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .order('invoice_date', { ascending: false });

      // Get liquidations with specialist info and items
      const { data: liquidations } = await supabase
        .from('liquidations')
        .select(`
          id,
          code,
          subtotal,
          total_amount,
          status,
          specialist:specialists(id, name),
          liquidation_items(
            id,
            description,
            total,
            financial_request:financial_requests(
              id,
              title,
              client:clients(id, name),
              contract:contracts(id, title)
            )
          )
        `)
        .eq('period_year', year)
        .eq('period_month', month)
        .order('created_at', { ascending: false });

      // Group invoices by client
      const invoicesByClient = new Map<string, { clientName: string; invoices: any[]; total: number }>();
      invoices?.forEach((inv: any) => {
        const clientId = inv.client?.id || 'unknown';
        const clientName = inv.client?.name || 'Sin cliente';
        const existing = invoicesByClient.get(clientId) || { clientName, invoices: [], total: 0 };
        existing.invoices.push(inv);
        existing.total += inv.subtotal || 0;
        invoicesByClient.set(clientId, existing);
      });

      // Group liquidations by specialist and then by client
      const liquidationsBySpecialist = new Map<string, { 
        specialistName: string; 
        liquidations: any[]; 
        total: number;
        byClient: Map<string, { clientName: string; items: any[]; total: number }>;
      }>();

      liquidations?.forEach((liq: any) => {
        const specialistId = liq.specialist?.id || 'unknown';
        const specialistName = liq.specialist?.name || 'Sin especialista';
        const existing = liquidationsBySpecialist.get(specialistId) || { 
          specialistName, 
          liquidations: [], 
          total: 0,
          byClient: new Map()
        };
        existing.liquidations.push(liq);
        existing.total += liq.subtotal || 0;

        // Group items by client
        liq.liquidation_items?.forEach((item: any) => {
          const clientId = item.financial_request?.client?.id || 'other';
          const clientName = item.financial_request?.client?.name || 'Otros conceptos';
          const clientData = existing.byClient.get(clientId) || { clientName, items: [], total: 0 };
          clientData.items.push({
            ...item,
            contractTitle: item.financial_request?.contract?.title
          });
          clientData.total += item.total || 0;
          existing.byClient.set(clientId, clientData);
        });

        liquidationsBySpecialist.set(specialistId, existing);
      });

      const totalInvoiced = invoices?.reduce((sum: number, inv: any) => sum + (inv.subtotal || 0), 0) || 0;
      const totalLiquidated = liquidations?.reduce((sum: number, liq: any) => sum + (liq.subtotal || 0), 0) || 0;

      return {
        invoices,
        liquidations,
        invoicesByClient: Array.from(invoicesByClient.values()),
        liquidationsBySpecialist: Array.from(liquidationsBySpecialist.entries()).map(([id, data]) => ({
          specialistId: id,
          ...data,
          byClient: Array.from(data.byClient.values())
        })),
        totalInvoiced,
        totalLiquidated,
        margin: totalInvoiced - totalLiquidated
      };
    },
    enabled: !!month,
  });

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['report-data', selectedReport, year, month],
    queryFn: async () => {
      const startDate = month 
        ? new Date(year, month - 1, 1).toISOString().split('T')[0]
        : new Date(year, 0, 1).toISOString().split('T')[0];

      const endDate = month
        ? new Date(year, month, 0).toISOString().split('T')[0]
        : new Date(year, 11, 31).toISOString().split('T')[0];

      switch (selectedReport) {
        case 'revenue_vs_costs': {
          const { data: invoices } = await supabase
            .from('invoices')
            .select('invoice_date, subtotal, status')
            .gte('invoice_date', startDate)
            .lte('invoice_date', endDate)
            .eq('status', 'paid');

          const { data: liquidations } = await supabase
            .from('liquidations')
            .select('period_year, period_month, subtotal, status')
            .eq('period_year', year)
            .eq('status', 'paid');

          return { invoices, liquidations };
        }

        case 'margin_by_client': {
          const { data: requests } = await supabase
            .from('financial_requests')
            .select('client_id, client:clients(name), cost_to_agency')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .in('status', ['in_progress', 'pending_review', 'completed']);

          return { requests };
        }

        case 'liquidations_by_specialist': {
          const { data: liquidations } = await supabase
            .from('liquidations')
            .select('specialist_id, specialist:specialists(name), total_amount, status, period_year, period_month')
            .eq('period_year', year);

          return { liquidations };
        }

        case 'requests_summary': {
          const { data: requests } = await supabase
            .from('financial_requests')
            .select('status, cost_to_agency, specialist:specialists(name)')
            .gte('created_at', startDate)
            .lte('created_at', endDate);

          return { requests };
        }

        default:
          return {};
      }
    },
  });

  // IRPF quarterly query
  const { data: irpfData, isLoading: loadingIrpf } = useIrpfQuarterly(year);

  const handleExportReport = () => {
    // IRPF Trimestral export
    if (selectedReport === 'irpf_quarterly') {
      if (!irpfData || irpfData.rows.length === 0) {
        toast.error('No hay datos de IRPF para exportar');
        return;
      }

      const header = ['Especialista', ...MONTH_NAMES_FULL, 'T1', 'T2', 'T3', 'T4', 'Total Año'];
      const data: any[][] = [
        [`Liquidación IRPF Trimestral - ${year}`],
        [`Generado: ${new Date().toLocaleDateString('es-ES')}`],
        [],
        header,
      ];

      irpfData.rows.forEach((row) => {
        data.push([
          row.name,
          ...row.monthly.map((v) => formatCurrency(v)),
          formatCurrency(row.quarterly[0]),
          formatCurrency(row.quarterly[1]),
          formatCurrency(row.quarterly[2]),
          formatCurrency(row.quarterly[3]),
          formatCurrency(row.yearTotal),
        ]);
      });

      // Totals row
      data.push([
        'TOTAL',
        ...irpfData.monthlyTotals.map((v) => formatCurrency(v)),
        ...irpfData.quarterlyTotals.map((v) => formatCurrency(v)),
        formatCurrency(irpfData.yearTotal),
      ]);

      data.push([]);
      data.push(['Resumen Trimestral']);
      data.push(['Trimestre', 'Meses', 'Pago a Hacienda', 'Total IRPF', 'Ya pagado (cierto)', 'Pendiente (previsión)', 'Estado']);
      irpfData.quarters.forEach((q) => {
        data.push([
          `${q.quarter}T`,
          q.months.map((m) => MONTH_NAMES_FULL[m - 1]).join(' + '),
          q.paymentDueDate.toLocaleDateString('es-ES'),
          formatCurrency(q.total),
          formatCurrency(q.totalPaid),
          formatCurrency(q.totalForecast),
          QUARTER_STATUS_LABEL[q.status]?.label ?? q.status,
        ]);
      });

      downloadExcel(data, `irpf_trimestral_${year}`);
      toast.success('Reporte IRPF exportado a Excel');
      return;
    }

    // For P&L by project, use consolidated data
    if (selectedReport === 'pnl_by_project') {
      if (!consolidatedPnL || consolidatedPnL.items.length === 0) {
        toast.error('No hay datos para exportar');
        return;
      }

      const data: any[][] = [
        ['Reporte P&L por Proyecto', '', '', '', '', new Date().toLocaleDateString('es-ES')],
        [],
        ['Cliente', 'Tipo', 'Nombre', 'Ingr. Facturado', 'Costes Liq.', 'Margen', '%'],
      ];

      consolidatedPnL.items.forEach((item) => {
        const marginPercent = item.pnl.invoicedRevenue > 0 
          ? (item.pnl.realMargin / item.pnl.invoicedRevenue) * 100 
          : 0;
        data.push([
          item.clientName,
          item.type === 'project' ? 'Proyecto' : 'Presupuesto',
          item.name,
          formatCurrency(item.pnl.invoicedRevenue),
          formatCurrency(item.pnl.liquidatedCosts),
          formatCurrency(item.pnl.realMargin),
          `${marginPercent.toFixed(1)}%`,
        ]);
      });

      data.push([]);
      data.push([
        'TOTAL', 
        '', 
        '', 
        formatCurrency(consolidatedPnL.totals.invoicedRevenue),
        formatCurrency(consolidatedPnL.totals.liquidatedCosts),
        formatCurrency(consolidatedPnL.totals.realMargin),
        `${consolidatedPnL.totals.realMarginPercent.toFixed(1)}%`,
      ]);

      downloadExcel(data, `reporte_pnl_proyectos_${new Date().getFullYear()}`);
      toast.success('Reporte exportado a Excel');
      return;
    }

    if (!reportData) {
      toast.error('No hay datos para exportar');
      return;
    }

    let data: any[][] = [];
    let fileName = '';

    switch (selectedReport) {
      case 'revenue_vs_costs': {
        const { invoices, liquidations } = reportData as any;
        
        data = [
          ['Reporte de Ingresos vs Costes', '', '', `Año: ${year}${month ? ` - Mes: ${month}` : ''}`],
          [],
          ['INGRESOS'],
          ['Mes', 'Subtotal', 'Estado'],
        ];

        invoices?.forEach((inv: any) => {
          data.push([
            new Date(inv.invoice_date).toLocaleDateString('es-ES'),
            formatCurrency(inv.subtotal),
            inv.status,
          ]);
        });

        const totalRevenue = invoices?.reduce((sum: number, i: any) => sum + i.subtotal, 0) || 0;
        data.push(['TOTAL INGRESOS', formatCurrency(totalRevenue), '']);
        data.push([]);

        data.push(['COSTES']);
        data.push(['Período', 'Subtotal', 'Estado']);

        liquidations?.forEach((liq: any) => {
          const monthName = new Date(liq.period_year, liq.period_month - 1)
            .toLocaleDateString('es-ES', { month: 'long' });
          data.push([monthName, formatCurrency(liq.subtotal), liq.status]);
        });

        const totalCosts = liquidations?.reduce((sum: number, l: any) => sum + l.subtotal, 0) || 0;
        data.push(['TOTAL COSTES', formatCurrency(totalCosts), '']);
        data.push([]);

        const margin = totalRevenue - totalCosts;
        const marginPercentage = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;
        data.push(['MARGEN', formatCurrency(margin), `${marginPercentage.toFixed(2)}%`]);

        fileName = `reporte_ingresos_costes_${year}`;
        break;
      }

      case 'margin_by_client': {
        const { requests } = reportData as any;
        
        data = [
          ['Reporte de Margen por Cliente', '', '', `Año: ${year}${month ? ` - Mes: ${month}` : ''}`],
          [],
          ['Cliente', 'Ingresos', 'Costes', 'Margen €', 'Margen %'],
        ];

        const clientMap = new Map<string, { name: string; cost: number }>();
        
        requests?.forEach((req: any) => {
          const clientId = req.client_id;
          const existing = clientMap.get(clientId) || { name: req.client.name, cost: 0 };
          existing.cost += req.cost_to_agency || 0;
          clientMap.set(clientId, existing);
        });

        clientMap.forEach((value) => {
          data.push([
            value.name,
            formatCurrency(value.cost),
            '',
            '',
            '',
          ]);
        });

        fileName = `reporte_margen_cliente_${year}`;
        break;
      }

      case 'liquidations_by_specialist': {
        const { liquidations } = reportData as any;
        
        data = [
          ['Reporte de Liquidaciones por Especialista', '', '', `Año: ${year}`],
          [],
          ['Especialista', 'Período', 'Monto', 'Estado'],
        ];

        liquidations?.forEach((liq: any) => {
          const monthName = new Date(liq.period_year, liq.period_month - 1)
            .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
          data.push([
            liq.specialist.name,
            monthName,
            formatCurrency(liq.total_amount),
            liq.status,
          ]);
        });

        const totalLiquidations = liquidations?.reduce((sum: number, l: any) => sum + l.total_amount, 0) || 0;
        data.push(['TOTAL', '', formatCurrency(totalLiquidations), '']);

        fileName = `reporte_liquidaciones_especialistas_${year}`;
        break;
      }

      case 'requests_summary': {
        const { requests } = reportData as any;
        
        data = [
          ['Resumen de Solicitudes', '', '', `Año: ${year}${month ? ` - Mes: ${month}` : ''}`],
          [],
          ['Estado', 'Cantidad', 'Ingresos', 'Costes', 'Margen'],
        ];

        const statusMap = new Map<string, { count: number; cost: number }>();
        
        requests?.forEach((req: any) => {
          const status = req.status;
          const existing = statusMap.get(status) || { count: 0, cost: 0 };
          existing.count++;
          existing.cost += req.cost_to_agency || 0;
          statusMap.set(status, existing);
        });

        statusMap.forEach((value, status) => {
          data.push([
            status,
            value.count.toString(),
            '',
            formatCurrency(value.cost),
            '',
          ]);
        });

        fileName = `reporte_solicitudes_${year}`;
        break;
      }
    }

    downloadExcel(data, fileName);
    toast.success('Reporte exportado a Excel');
  };

  // Consolidated P&L query
  const { data: consolidatedPnL, isLoading: loadingPnL } = useConsolidatedPnL();

  const reports = [
    {
      id: 'revenue_vs_costs' as ReportType,
      title: 'Ingresos vs Costes',
      description: 'Comparativa de ingresos facturados vs costes de liquidaciones',
      icon: TrendingUp,
    },
    {
      id: 'margin_by_client' as ReportType,
      title: 'Margen por Cliente',
      description: 'Análisis de rentabilidad por cliente',
      icon: Users,
    },
    {
      id: 'liquidations_by_specialist' as ReportType,
      title: 'Liquidaciones por Especialista',
      description: 'Resumen de pagos a especialistas',
      icon: DollarSign,
    },
    {
      id: 'requests_summary' as ReportType,
      title: 'Resumen de Solicitudes',
      description: 'Estado y rentabilidad de solicitudes',
      icon: FileBarChart,
    },
    {
      id: 'pnl_by_project' as ReportType,
      title: 'P&L por Proyecto',
      description: 'Cuenta de resultados por proyecto y presupuesto',
      icon: FolderKanban,
    },
    {
      id: 'irpf_quarterly' as ReportType,
      title: 'Liquidación IRPF Trimestral',
      description: 'IRPF retenido a especialistas por mes y trimestre',
      icon: Landmark,
    },
  ];

  const currentReport = reports.find((r) => r.id === selectedReport);
  const monthName = month ? new Date(year, month - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : null;

  return (
    <AppLayout title="Reportes" description="Generación de reportes y análisis">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Reportes y Análisis</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reports.map((report) => {
            const Icon = report.icon;
            return (
              <Card
                key={report.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedReport === report.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedReport(report.id)}
              >
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{report.title}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {report.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Parámetros del Reporte</CardTitle>
            <CardDescription>Selecciona el período para generar el reporte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Año</Label>
                <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mes (Opcional)</Label>
                <Select
                  value={month?.toString() || 'all'}
                  onValueChange={(v) => setMonth(v === 'all' ? null : parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todo el año" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo el año</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {new Date(2024, m - 1).toLocaleDateString('es-ES', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleExportReport}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar a Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {currentReport && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <currentReport.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{currentReport.title}</CardTitle>
                  <CardDescription>{currentReport.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedReport === 'pnl_by_project' ? (
                loadingPnL ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : consolidatedPnL && consolidatedPnL.items.length > 0 ? (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Proyecto / Presupuesto</TableHead>
                          <TableHead className="text-right">Ingr. Facturado</TableHead>
                          <TableHead className="text-right">Costes Liq.</TableHead>
                          <TableHead className="text-right">Margen</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {consolidatedPnL.items.map((item) => {
                          const marginPercent = item.pnl.invoicedRevenue > 0 
                            ? (item.pnl.realMargin / item.pnl.invoicedRevenue) * 100 
                            : 0;
                          return (
                            <TableRow key={`${item.type}-${item.id}`}>
                              <TableCell className="font-medium">{item.clientName}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {item.type === 'project' ? 'Proyecto' : 'Presupuesto'}
                                  </Badge>
                                  {item.name}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-green-600 font-medium">
                                {formatCurrency(item.pnl.invoicedRevenue)}
                              </TableCell>
                              <TableCell className="text-right text-red-600 font-medium">
                                {formatCurrency(item.pnl.liquidatedCosts)}
                              </TableCell>
                              <TableCell className={`text-right font-bold ${item.pnl.realMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(item.pnl.realMargin)}
                              </TableCell>
                              <TableCell className={`text-right ${marginPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {marginPercent.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {/* Totals Row */}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell colSpan={2}>TOTAL</TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(consolidatedPnL.totals.invoicedRevenue)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {formatCurrency(consolidatedPnL.totals.liquidatedCosts)}
                          </TableCell>
                          <TableCell className={`text-right ${consolidatedPnL.totals.realMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(consolidatedPnL.totals.realMargin)}
                          </TableCell>
                          <TableCell className={`text-right ${consolidatedPnL.totals.realMarginPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {consolidatedPnL.totals.realMarginPercent.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    <p className="text-xs text-muted-foreground">
                      {consolidatedPnL.items.length} proyectos/presupuestos | {consolidatedPnL.totals.totalRequests} requests totales
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No hay proyectos o presupuestos con datos financieros
                  </p>
                )
              ) : isLoading ? (
                <p className="text-muted-foreground">Cargando datos del reporte...</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Haz clic en "Exportar a Excel" para generar el reporte con los parámetros seleccionados.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Monthly Details Section - Only shows when month is selected */}
        {month && (
          <div className="space-y-6">
            {/* Summary Cards */}
            {loadingMonthlyDetails ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : monthlyDetails && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Receipt className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Facturado</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(monthlyDetails.totalInvoiced)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Wallet className="h-8 w-8 text-red-600" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Liquidaciones</p>
                        <p className="text-2xl font-bold text-red-600">
                          {formatCurrency(monthlyDetails.totalLiquidated)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`border-blue-200 ${monthlyDetails.margin >= 0 ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-orange-50 dark:bg-orange-950/20'}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <TrendingUp className={`h-8 w-8 ${monthlyDetails.margin >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                      <div>
                        <p className="text-sm text-muted-foreground">Margen</p>
                        <p className={`text-2xl font-bold ${monthlyDetails.margin >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {formatCurrency(monthlyDetails.margin)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Invoices by Client */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <Receipt className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>Facturas por Cliente - {monthName}</CardTitle>
                    <CardDescription>Detalle de ingresos facturados a cada cliente</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingMonthlyDetails ? (
                  <Skeleton className="h-40" />
                ) : monthlyDetails?.invoicesByClient && monthlyDetails.invoicesByClient.length > 0 ? (
                  <div className="space-y-4">
                    {monthlyDetails.invoicesByClient.map((clientData: any, idx: number) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold text-lg">{clientData.clientName}</h4>
                          <span className="text-lg font-bold text-green-600">
                            {formatCurrency(clientData.total)}
                          </span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Código</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead className="text-right">Subtotal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clientData.invoices.map((inv: any) => (
                              <TableRow key={inv.id}>
                                <TableCell className="font-medium">{inv.code}</TableCell>
                                <TableCell>{new Date(inv.invoice_date).toLocaleDateString('es-ES')}</TableCell>
                                <TableCell>
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                                    inv.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {inv.status === 'paid' ? 'Cobrada' : inv.status === 'sent' ? 'Enviada' : inv.status}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(inv.subtotal)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No hay facturas en este período</p>
                )}
              </CardContent>
            </Card>

            {/* Liquidations by Specialist */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <Wallet className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle>Liquidaciones por Especialista - {monthName}</CardTitle>
                    <CardDescription>Pagos a especialistas desglosados por cliente y proyecto</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingMonthlyDetails ? (
                  <Skeleton className="h-40" />
                ) : monthlyDetails?.liquidationsBySpecialist && monthlyDetails.liquidationsBySpecialist.length > 0 ? (
                  <div className="space-y-6">
                    {monthlyDetails.liquidationsBySpecialist.map((specData: any) => (
                      <div key={specData.specialistId} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-semibold text-lg flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                              {specData.specialistName.charAt(0)}
                            </span>
                            {specData.specialistName}
                          </h4>
                          <span className="text-lg font-bold text-red-600">
                            {formatCurrency(specData.total)}
                          </span>
                        </div>
                        
                        {/* Breakdown by client */}
                        {specData.byClient.length > 0 && (
                          <div className="space-y-3">
                            {specData.byClient.map((clientData: any, idx: number) => (
                              <div key={idx} className="bg-muted/50 rounded-lg p-3">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-medium text-sm">{clientData.clientName}</span>
                                  <span className="font-semibold text-red-600">{formatCurrency(clientData.total)}</span>
                                </div>
                                <div className="space-y-1">
                                  {clientData.items.map((item: any, itemIdx: number) => (
                                    <div key={itemIdx} className="flex justify-between text-sm text-muted-foreground pl-4">
                                      <span className="truncate flex-1">
                                        {item.description}
                                        {item.contractTitle && (
                                          <span className="text-xs ml-2 text-primary">({item.contractTitle})</span>
                                        )}
                                      </span>
                                      <span className="ml-4">{formatCurrency(item.total)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No hay liquidaciones en este período</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
