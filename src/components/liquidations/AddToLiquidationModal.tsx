import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { formatCurrency, getMonthName, formatPeriod } from '@/lib/liquidation-utils';
import { AlertCircle, Receipt } from 'lucide-react';

interface AddToLiquidationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestIds: string[];
  onSuccess: () => void;
}

export const AddToLiquidationModal = ({
  open,
  onOpenChange,
  requestIds,
  onSuccess,
}: AddToLiquidationModalProps) => {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [selectedLiquidationId, setSelectedLiquidationId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Fetch selected requests with details
  const { data: selectedRequests, isLoading: loadingRequests } = useQuery({
    queryKey: ['selected-requests-for-liquidation', requestIds],
    queryFn: async () => {
      if (requestIds.length === 0) return [];
      const { data, error } = await supabase
        .from('financial_requests')
        .select(`
          id, code, title, cost_to_agency, specialist_id, status, liquidation_id,
          client:clients(id, name),
          specialist:specialists(id, name)
        `)
        .in('id', requestIds);
      if (error) throw error;
      return data;
    },
    enabled: open && requestIds.length > 0,
  });

  // Get unique specialist from selected requests
  const specialistInfo = useMemo(() => {
    if (!selectedRequests || selectedRequests.length === 0) return null;
    
    const specialistIds = new Set(selectedRequests.map(r => r.specialist_id).filter(Boolean));
    if (specialistIds.size === 0) return { error: 'no_specialist' };
    if (specialistIds.size > 1) return { error: 'multiple_specialists' };
    
    const firstWithSpecialist = selectedRequests.find(r => r.specialist_id);
    return {
      id: firstWithSpecialist?.specialist_id,
      name: firstWithSpecialist?.specialist?.name,
    };
  }, [selectedRequests]);

  // Check for already liquidated requests
  const alreadyLiquidated = useMemo(() => {
    if (!selectedRequests) return [];
    return selectedRequests.filter(r => r.liquidation_id !== null);
  }, [selectedRequests]);

  // Valid requests (not liquidated, has specialist)
  const validRequests = useMemo(() => {
    if (!selectedRequests) return [];
    return selectedRequests.filter(r => r.liquidation_id === null && r.specialist_id);
  }, [selectedRequests]);

  // Fetch ALL existing liquidations for this specialist (not just drafts)
  const { data: existingLiquidations, isLoading: loadingLiquidations } = useQuery({
    queryKey: ['all-liquidations-for-specialist', specialistInfo?.id],
    queryFn: async () => {
      if (!specialistInfo?.id) return [];
      const { data, error } = await supabase
        .from('liquidations')
        .select('id, code, period_year, period_month, subtotal, status')
        .eq('specialist_id', specialistInfo.id)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!specialistInfo?.id,
  });

  // Filter editable liquidations (draft, validated, sent) for "existing" mode
  const editableLiquidations = useMemo(() => {
    return existingLiquidations?.filter(l => ['draft', 'validated', 'sent'].includes(l.status)) || [];
  }, [existingLiquidations]);

  // Check if a liquidation already exists for selected period
  const existingLiquidationForPeriod = useMemo(() => {
    if (!existingLiquidations || mode !== 'new') return null;
    return existingLiquidations.find(
      l => l.period_year === selectedYear && l.period_month === selectedMonth
    );
  }, [existingLiquidations, selectedYear, selectedMonth, mode]);

  // Calculate total cost
  const totalCost = useMemo(() => {
    if (!validRequests) return 0;
    return validRequests.reduce((sum, r) => sum + (r.cost_to_agency || 0), 0);
  }, [validRequests]);

  // Mutation to add requests to liquidation
  const addToLiquidationMutation = useMutation({
    mutationFn: async () => {
      if (!specialistInfo?.id || validRequests.length === 0) {
        throw new Error('No hay solicitudes válidas para añadir');
      }

      let liquidationId: string;
      let liquidationCode: string;

      if (mode === 'new') {
        // Check if liquidation already exists for this period
        if (existingLiquidationForPeriod) {
          // If it's editable (draft, validated, sent), use it; otherwise throw error
          if (['draft', 'validated', 'sent'].includes(existingLiquidationForPeriod.status)) {
            liquidationId = existingLiquidationForPeriod.id;
            liquidationCode = existingLiquidationForPeriod.code;
          } else {
            throw new Error(
              `Ya existe una liquidación para ${getMonthName(selectedMonth)} ${selectedYear} (${existingLiquidationForPeriod.code}) con estado "${existingLiquidationForPeriod.status}". Selecciona otro período.`
            );
          }
        } else {
          // Create new liquidation
          const { data: newLiq, error: createError } = await supabase
            .from('liquidations')
            .insert({
              specialist_id: specialistInfo.id,
              period_year: selectedYear,
              period_month: selectedMonth,
              code: '', // Will be auto-generated
              status: 'draft',
              subtotal: 0,
              tax_rate: 21,
              tax_amount: 0,
              total_amount: 0,
            })
            .select()
            .single();

          if (createError) throw createError;
          liquidationId = newLiq.id;
          liquidationCode = newLiq.code;
        }
      } else {
        // Use existing liquidation
        if (!selectedLiquidationId) throw new Error('Selecciona una liquidación');
        liquidationId = selectedLiquidationId;
        const existing = editableLiquidations?.find(l => l.id === selectedLiquidationId);
        liquidationCode = existing?.code || '';
      }

      // GUARD: block adding requests with cost_to_agency <= 0
      const zeroCost = validRequests.filter((r: any) => (Number(r.cost_to_agency) || 0) <= 0);
      if (zeroCost.length > 0) {
        throw new Error(
          `No se pueden añadir requests con coste 0 €: ${zeroCost.map((r: any) => r.code).join(', ')}. Edita la request y asigna una tarifa de coste válida antes de liquidar.`
        );
      }

      // Create liquidation items
      const items = validRequests.map((r: any) => {
        const total = Number(r.cost_to_agency) || 0;
        const isHourly = r.cost_type === 'hourly';
        const quantity = isHourly ? (Number(r.hours) || 1) : (Number(r.quantity) || 1);
        const unitPrice = isHourly
          ? (Number(r.cost_rate) || (quantity > 0 ? total / quantity : 0))
          : (Number(r.fixed_cost) || total);
        return {
          liquidation_id: liquidationId,
          financial_request_id: r.id,
          description: `${r.code} - ${r.title}`,
          quantity,
          unit_price: unitPrice,
          total,
        };
      });


      const { error: itemsError } = await supabase
        .from('liquidation_items')
        .insert(items);

      if (itemsError) throw itemsError;

      // Update financial_requests with liquidation_id and status
      const { error: updateError } = await supabase
        .from('financial_requests')
      .update({ 
          liquidation_id: liquidationId
        })
        .in('id', validRequests.map(r => r.id));

      if (updateError) throw updateError;

      // Recalculate liquidation totals
      const { data: allItems, error: fetchItemsError } = await supabase
        .from('liquidation_items')
        .select('total')
        .eq('liquidation_id', liquidationId);

      if (fetchItemsError) throw fetchItemsError;

      const newSubtotal = allItems.reduce((sum, item) => sum + (item.total || 0), 0);
      const taxAmount = (newSubtotal * 21) / 100;
      const totalAmount = newSubtotal + taxAmount;

      const { error: updateLiqError } = await supabase
        .from('liquidations')
        .update({
          subtotal: newSubtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
        })
        .eq('id', liquidationId);

      if (updateLiqError) throw updateLiqError;

      return { liquidationCode, count: validRequests.length };
    },
    onSuccess: (result) => {
      toast.success(`${result.count} solicitudes añadidas a ${result.liquidationCode}`);
      queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    addToLiquidationMutation.mutate();
  };

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: getMonthName(i + 1),
  }));

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i);

  const hasError = specialistInfo?.error;
  const isLoading = loadingRequests || loadingLiquidations;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Añadir Solicitudes a Liquidación
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg font-medium text-destructive">
              {specialistInfo?.error === 'no_specialist'
                ? 'Las solicitudes seleccionadas no tienen especialista asignado'
                : 'Las solicitudes seleccionadas pertenecen a diferentes especialistas'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {specialistInfo?.error === 'multiple_specialists'
                ? 'Selecciona solicitudes del mismo especialista para añadirlas a una liquidación'
                : 'Asigna un especialista a las solicitudes antes de liquidarlas'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Specialist info */}
            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-sm text-muted-foreground">Especialista</Label>
              <p className="font-medium">{specialistInfo?.name}</p>
            </div>

            {/* Already liquidated warning */}
            {alreadyLiquidated.length > 0 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  {alreadyLiquidated.length} solicitud(es) ya están liquidadas y serán omitidas
                </p>
              </div>
            )}

            {/* Mode selection */}
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'new' | 'existing')}>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value="new" id="new" />
                  <Label htmlFor="new" className="flex-1 cursor-pointer">
                    <span className="font-medium">Crear nueva liquidación</span>
                    {mode === 'new' && (
                      <div className="space-y-2 mt-2">
                        <div className="flex gap-2">
                          <Select
                            value={selectedMonth.toString()}
                            onValueChange={(v) => setSelectedMonth(parseInt(v))}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {months.map((m) => (
                                <SelectItem key={m.value} value={m.value.toString()}>
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={selectedYear.toString()}
                            onValueChange={(v) => setSelectedYear(parseInt(v))}
                          >
                            <SelectTrigger className="w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {years.map((y) => (
                                <SelectItem key={y} value={y.toString()}>
                                  {y}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {existingLiquidationForPeriod && (
                          <div className={`text-sm p-2 rounded ${['draft', 'validated', 'sent'].includes(existingLiquidationForPeriod.status) ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-destructive/10 text-destructive'}`}>
                            {['draft', 'validated', 'sent'].includes(existingLiquidationForPeriod.status)
                              ? `✓ Ya existe ${existingLiquidationForPeriod.code} (${existingLiquidationForPeriod.status}). Las solicitudes se añadirán a esta liquidación.`
                              : `⚠️ Ya existe ${existingLiquidationForPeriod.code} con estado "${existingLiquidationForPeriod.status}". Selecciona otro período.`
                            }
                          </div>
                        )}
                      </div>
                    )}
                  </Label>
                </div>

                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value="existing" id="existing" className="mt-1" />
                  <Label htmlFor="existing" className="flex-1 cursor-pointer">
                    <span className="font-medium">Añadir a liquidación existente</span>
                    {mode === 'existing' && (
                      <div className="mt-2">
                        {editableLiquidations && editableLiquidations.length > 0 ? (
                          <Select
                            value={selectedLiquidationId}
                            onValueChange={setSelectedLiquidationId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una liquidación" />
                            </SelectTrigger>
                            <SelectContent>
                              {editableLiquidations.map((liq) => (
                                <SelectItem key={liq.id} value={liq.id}>
                                  {liq.code} - {formatPeriod(liq.period_year, liq.period_month)} ({liq.status})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No hay liquidaciones editables para este especialista
                          </p>
                        )}
                      </div>
                    )}
                  </Label>
                </div>
              </div>
            </RadioGroup>

            {/* Requests table */}
            <div>
              <Label className="mb-2 block">
                Solicitudes a añadir ({validRequests.length})
              </Label>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Coste</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-mono text-xs">{req.code}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{req.title}</TableCell>
                        <TableCell>{req.client?.name}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(req.cost_to_agency || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="font-medium">Total a liquidar</span>
              <span className="text-lg font-bold">{formatCurrency(totalCost)}</span>
            </div>

            {/* Info */}
            <p className="text-sm text-muted-foreground">
              ⚠️ La liquidación permanecerá en estado borrador para permitir añadir más solicitudes
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isLoading ||
              !!hasError ||
              validRequests.length === 0 ||
              addToLiquidationMutation.isPending ||
              (mode === 'existing' && !selectedLiquidationId) ||
              (mode === 'new' && existingLiquidationForPeriod && existingLiquidationForPeriod.status !== 'draft')
            }
          >
            {addToLiquidationMutation.isPending ? 'Añadiendo...' : 'Añadir a Liquidación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
