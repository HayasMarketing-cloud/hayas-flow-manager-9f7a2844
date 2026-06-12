import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useOverdueRequests, dashboardAdminPeriod } from '@/hooks/useDashboardAdmin';
import { formatCurrency } from '@/lib/request-utils';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const monthsLate = (y: number, m: number) =>
  (dashboardAdminPeriod.year - y) * 12 + (dashboardAdminPeriod.month - m);

export const OverdueRequestsCard = () => {
  const { data, isLoading } = useOverdueRequests();

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Requests atrasados de meses anteriores
          {data && <Badge variant="destructive">{data.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin requests atrasados. Todo al día ✓</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Especialista</TableHead>
                <TableHead>Mes trabajo</TableHead>
                <TableHead>Retraso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell>{r.client?.name ?? '—'}</TableCell>
                  <TableCell className="max-w-[260px] truncate">{r.title}</TableCell>
                  <TableCell>{r.specialist?.name ?? '—'}</TableCell>
                  <TableCell>{MONTHS[r.work_month - 1]} {r.work_year}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">
                      {monthsLate(r.work_year, r.work_month)} mes(es)
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(r.sale_amount ?? 0))}</TableCell>
                  <TableCell>
                    <Link to={`/solicitudes/${r.id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
