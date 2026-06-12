import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, ExternalLink } from 'lucide-react';
import { usePendingBudgets } from '@/hooks/useDashboardAdmin';
import { formatCurrency } from '@/lib/request-utils';

const daysSince = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));

export const PendingBudgetsCard = () => {
  const { data, isLoading } = usePendingBudgets();
  return (
    <Card className="border-yellow-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-yellow-600" />
          Presupuestos pendientes de aprobar
          {data && <Badge variant="secondary">{data.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin presupuestos pendientes ✓</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Días pendiente</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(b => {
                const d = daysSince(b.created_at);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.code}</TableCell>
                    <TableCell>{b.client?.name ?? '—'}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{b.title}</TableCell>
                    <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={d > 14 ? 'destructive' : d > 7 ? 'secondary' : 'outline'}>
                        {d} días
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(b.total_amount ?? 0))}</TableCell>
                    <TableCell>
                      <Link to={`/presupuestos/${b.id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
