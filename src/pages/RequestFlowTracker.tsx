import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRequestsWithFlow } from '@/hooks/useRequestFlow';
import { getRequestFlowStatus, getFlowStageLabel, getFlowStageColor, calculateFlowStatistics } from '@/lib/flowHelpers';
import { RequestFlowActions } from '@/components/requests/RequestFlowActions';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, FileText, Wallet, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/request-utils';
import { useUserRole } from '@/hooks/useUserRole';

export default function RequestFlowTracker() {
  const [searchTerm, setSearchTerm] = useState('');
  const [flowStageFilter, setFlowStageFilter] = useState<string>('all');
  const { canAccessFinance, canAccessOperations } = useUserRole();
  const canManage = canAccessFinance() || canAccessOperations();

  const { data: requests, isLoading } = useRequestsWithFlow({
    flowStage: flowStageFilter === 'all' ? null : flowStageFilter,
  });

  const filteredRequests = requests?.filter((request) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      request.code?.toLowerCase().includes(search) ||
      request.title?.toLowerCase().includes(search) ||
      request.client?.name?.toLowerCase().includes(search)
    );
  });

  const stats = filteredRequests ? calculateFlowStatistics(filteredRequests) : null;

  if (!canManage) {
    return (
      <AppLayout title="Seguimiento de Flujo">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-destructive">No tienes permisos para acceder a esta sección</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Seguimiento de Flujo" description="Monitoreo del ciclo completo: Solicitudes → Facturas → Liquidaciones">
      <div className="space-y-6">
        {/* Estadísticas */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendientes Facturar</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pending}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats.pendingValue)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Facturados</CardTitle>
                <FileText className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.invoiced}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats.invoicedValue)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">En Liquidación</CardTitle>
                <Wallet className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.liquidated}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats.liquidatedValue)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">
                  Completados: {stats.completed}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código, título o cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={flowStageFilter} onValueChange={setFlowStageFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Etapa del flujo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las etapas</SelectItem>
                  <SelectItem value="pending">Pendiente facturar</SelectItem>
                  <SelectItem value="invoiced">Facturado</SelectItem>
                  <SelectItem value="liquidated">En liquidación</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Requests */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredRequests && filteredRequests.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Especialista</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Factura</TableHead>
                      <TableHead>Liquidación</TableHead>
                      <TableHead>Estado Flujo</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => {
                      const flowStatus = getRequestFlowStatus(request);

                      return (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.code}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{request.title}</TableCell>
                          <TableCell>{request.client?.name}</TableCell>
                          <TableCell>{request.specialist?.name || '-'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(request.total)}</TableCell>
                          <TableCell>
                            {flowStatus.hasInvoice ? (
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-500" />
                                <span className="text-sm">{request.billed_invoice?.code}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {flowStatus.hasLiquidation ? (
                              <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-purple-500" />
                                <span className="text-sm">{request.liquidation?.code}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={getFlowStageColor(flowStatus.flowStage)}>
                              {getFlowStageLabel(flowStatus.flowStage)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <RequestFlowActions request={request} variant="ghost" size="sm" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">
                  {searchTerm || flowStageFilter !== 'all'
                    ? 'No se encontraron solicitudes'
                    : 'No hay solicitudes completadas aún'}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {searchTerm || flowStageFilter !== 'all'
                    ? 'Intenta con otros filtros'
                    : 'Las solicitudes completadas aparecerán aquí'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
