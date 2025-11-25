import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Download, FileBarChart, TrendingUp, Users, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { downloadExcel, formatCurrency } from '@/utils/excel/excelExporter';

type ReportType = 'revenue_vs_costs' | 'margin_by_client' | 'liquidations_by_specialist' | 'requests_summary';

export default function Reportes() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('revenue_vs_costs');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);

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
            .in('status', ['active', 'invoiced', 'liquidated']);

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

  const handleExportReport = () => {
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
  ];

  const currentReport = reports.find((r) => r.id === selectedReport);

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
              {isLoading ? (
                <p className="text-muted-foreground">Cargando datos del reporte...</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Haz clic en "Exportar a Excel" para generar el reporte con los parámetros seleccionados.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
