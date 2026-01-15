import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUnliquidatedRequests } from '@/hooks/useUnliquidatedRequests';
import { formatCurrency } from '@/lib/liquidation-utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AddRequestsToLiquidationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liquidationId: string;
  specialistId: string;
  onSuccess?: () => void;
}

export function AddRequestsToLiquidationModal({
  open,
  onOpenChange,
  liquidationId,
  specialistId,
  onSuccess,
}: AddRequestsToLiquidationModalProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: requests, isLoading } = useUnliquidatedRequests(specialistId);

  const totalToAdd = useMemo(() => {
    if (!requests) return 0;
    return requests
      .filter((r) => selectedIds.includes(r.id))
      .reduce((sum, r) => sum + (Number(r.cost_to_agency) || 0), 0);
  }, [requests, selectedIds]);

  const toggleRequest = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (!requests) return;
    if (selectedIds.length === requests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(requests.map((r) => r.id));
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (selectedIds.length === 0) throw new Error('No hay solicitudes seleccionadas');

      const selectedRequests = requests?.filter((r) => selectedIds.includes(r.id)) || [];

      // Create liquidation_items
      const items = selectedRequests.map((req) => ({
        liquidation_id: liquidationId,
        financial_request_id: req.id,
        description: req.title || 'Servicio',
        quantity: 1,
        unit_price: Number(req.cost_to_agency) || 0,
        total: Number(req.cost_to_agency) || 0,
      }));

      const { error: itemsError } = await supabase
        .from('liquidation_items')
        .insert(items);

      if (itemsError) throw itemsError;

      // Update financial_requests with liquidation_id
      const { error: reqError } = await supabase
        .from('financial_requests')
        .update({ liquidation_id: liquidationId })
        .in('id', selectedIds);

      if (reqError) throw reqError;

      // Recalculate liquidation totals
      const { data: allItems, error: fetchError } = await supabase
        .from('liquidation_items')
        .select('total')
        .eq('liquidation_id', liquidationId);

      if (fetchError) throw fetchError;

      const newTotal = allItems?.reduce((sum, item) => sum + (Number(item.total) || 0), 0) || 0;

      const { error: updateError } = await supabase
        .from('liquidations')
        .update({ total_amount: newTotal })
        .eq('id', liquidationId);

      if (updateError) throw updateError;

      return selectedIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['liquidation-detail'] });
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      queryClient.invalidateQueries({ queryKey: ['unliquidated-requests'] });
      toast.success(`${count} solicitud(es) añadida(s) a la liquidación`);
      setSelectedIds([]);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error('Error al añadir solicitudes: ' + error.message);
    },
  });

  const handleSubmit = () => {
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Añadir Solicitudes a Liquidación</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !requests || requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay solicitudes pendientes de liquidar para este especialista
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.length === requests.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Coste</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(request.id)}
                        onCheckedChange={() => toggleRequest(request.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{request.code}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{request.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{request.client?.name || '-'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {request.created_at
                        ? format(new Date(request.created_at), 'dd MMM yyyy', { locale: es })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(request.cost_to_agency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {requests && requests.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} de {requests.length} seleccionadas
              </span>
              <div className="text-lg font-bold">
                Total a añadir: <span className="text-primary">{formatCurrency(totalToAdd)}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedIds.length === 0 || mutation.isPending}
          >
            {mutation.isPending ? 'Añadiendo...' : `Añadir ${selectedIds.length} Solicitud(es)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
