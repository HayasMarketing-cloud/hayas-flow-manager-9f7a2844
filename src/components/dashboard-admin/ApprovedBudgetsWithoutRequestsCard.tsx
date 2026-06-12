import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileWarning, ExternalLink } from 'lucide-react';
import { useApprovedBudgetsWithoutRequests } from '@/hooks/useDashboardAdmin';
import { formatCurrency } from '@/lib/request-utils';

export const ApprovedBudgetsWithoutRequestsCard = () => {
  const { data, isLoading } = useApprovedBudgetsWithoutRequests();
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileWarning className="h-4 w-4 text-destructive" />
          Presupuestos aprobados sin requests (meses anteriores)
          {data && <Badge variant="destructive">{data.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos los presupuestos aprobados tienen requests generados ✓</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Aprobado</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.code}</TableCell>
                  <TableCell>{b.client?.name ?? '—'}</TableCell>
                  <TableCell className="max-w-[300px] truncate">{b.title}</TableCell>
                  <TableCell>{new Date(b.created_at).toLocaleDateString('es-ES')}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(b.total_amount ?? 0))}</TableCell>
                  <TableCell>
                    <Link to={`/presupuestos/${b.id}`} className="text-primary hover:underline inline-flex items-center gap-1">
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
