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
import { toast } from 'sonner';
import { formatCurrency, getMonthName, formatPeriod } from '@/lib/liquidation-utils';
import { AlertCircle, Receipt, Loader2 } from 'lucide-react';

interface CommissionForLiquidation {
  id: string;
  seller_user_id: string;
  commission_amount: number;
  commission_type?: string;
  commission_percentage: number;
  base_amount: number;
  notes: string | null;
  seller_profile?: { full_name: string } | null;
  contract?: { code: string; title: string } | null;
  budget?: { code: string; title: string } | null;
}

interface AddCommissionToLiquidationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commission: CommissionForLiquidation | null;
  onSuccess: () => void;
}

const typeLabels: Record<string, string> = {
  sales: 'Venta',
  am: 'AM',
  pm: 'PM',
};

export const AddCommissionToLiquidationModal = ({
  open,
  onOpenChange,
  commission,
  onSuccess,
}: AddCommissionToLiquidationModalProps) => {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [selectedLiquidationId, setSelectedLiquidationId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Look up specialist by seller_user_id
  const { data: specialist, isLoading: loadingSpecialist } = useQuery({
    queryKey: ['specialist-by-user', commission?.seller_user_id],
    queryFn: async () => {
      if (!commission?.seller_user_id) return null;
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name, email')
        .eq('user_id', commission.seller_user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!commission?.seller_user_id,
  });

  // Fetch all existing liquidations for this specialist
  const { data: existingLiquidations, isLoading: loadingLiquidations } = useQuery({
    queryKey: ['all-liquidations-for-specialist', specialist?.id],
    queryFn: async () => {
      if (!specialist?.id) return [];
      const { data, error } = await supabase
        .from('liquidations')
        .select('id, code, period_year, period_month, subtotal, status')
        .eq('specialist_id', specialist.id)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!specialist?.id,
  });

  const draftLiquidations = useMemo(() => {
    return existingLiquidations?.filter(l => l.status === 'draft') || [];
  }, [existingLiquidations]);

  const existingLiquidationForPeriod = useMemo(() => {
    if (!existingLiquidations || mode !== 'new') return null;
    return existingLiquidations.find(
      l => l.period_year === selectedYear && l.period_month === selectedMonth
    );
  }, [existingLiquidations, selectedYear, selectedMonth, mode]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!commission || !specialist?.id) throw new Error('Datos insuficientes');

      let liquidationId: string;
      let liquidationCode: string;

      if (mode === 'new') {
        if (existingLiquidationForPeriod) {
          if (existingLiquidationForPeriod.status === 'draft') {
            liquidationId = existingLiquidationForPeriod.id;
            liquidationCode = existingLiquidationForPeriod.code;
          } else {
            throw new Error(
              `Ya existe una liquidación para ${getMonthName(selectedMonth)} ${selectedYear} (${existingLiquidationForPeriod.code}) con estado "${existingLiquidationForPeriod.status}".`
            );
          }
        } else {
          const { data: newLiq, error: createError } = await supabase
            .from('liquidations')
            .insert({
              specialist_id: specialist.id,
              period_year: selectedYear,
              period_month: selectedMonth,
              code: '',
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
        if (!selectedLiquidationId) throw new Error('Selecciona una liquidación');
        liquidationId = selectedLiquidationId;
        liquidationCode = draftLiquidations.find(l => l.id === selectedLiquidationId)?.code || '';
      }

      // Build description
      const origin = commission.contract
        ? `${commission.contract.code} - ${commission.contract.title}`
        : commission.budget
          ? `${commission.budget.code} - ${commission.budget.title}`
          : '';
      const typeLabel = typeLabels[commission.commission_type || 'sales'] || commission.commission_type;
      const description = `Comisión ${typeLabel} (${commission.commission_percentage}%)${origin ? ` — ${origin}` : ''}`;

      // Create liquidation item
      const { error: itemError } = await supabase
        .from('liquidation_items')
        .insert({
          liquidation_id: liquidationId,
          description,
          quantity: 1,
          unit_price: commission.commission_amount,
          total: commission.commission_amount,
        });
      if (itemError) throw itemError;

      // Update commission with liquidation_id
      const { error: updateError } = await (supabase
        .from('sales_commissions' as any)
        .update({ liquidation_id: liquidationId })
        .eq('id', commission.id) as any);
      if (updateError) throw updateError;

      // Recalculate liquidation totals
      const { data: allItems, error: fetchError } = await supabase
        .from('liquidation_items')
        .select('total')
        .eq('liquidation_id', liquidationId);
      if (fetchError) throw fetchError;

      const newSubtotal = allItems.reduce((sum, item) => sum + (item.total || 0), 0);
      const taxAmount = (newSubtotal * 21) / 100;
      const totalAmount = newSubtotal + taxAmount;

      const { error: updateLiqError } = await supabase
        .from('liquidations')
        .update({ subtotal: newSubtotal, tax_amount: taxAmount, total_amount: totalAmount })
        .eq('id', liquidationId);
      if (updateLiqError) throw updateLiqError;

      return liquidationCode;
    },
    onSuccess: (code) => {
      toast.success(`Comisión añadida a ${code}`);
      queryClient.invalidateQueries({ queryKey: ['sales-commissions'] });
      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: getMonthName(i + 1),
  }));
  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i);

  const isLoading = loadingSpecialist || loadingLiquidations;
  const noSpecialist = !loadingSpecialist && !specialist;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Añadir Comisión a Liquidación
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : noSpecialist ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg font-medium text-destructive">
              No se encontró especialista vinculado
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              El beneficiario {commission?.seller_profile?.full_name} no tiene un registro de especialista vinculado.
              Vincúlalo primero en la sección de especialistas.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Commission & specialist info */}
            <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Especialista</span>
                <span className="font-medium">{specialist?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Importe comisión</span>
                <span className="font-bold">{formatCurrency(commission?.commission_amount || 0)}</span>
              </div>
            </div>

            {/* Mode selection */}
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'new' | 'existing')}>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value="new" id="comm-new" />
                  <Label htmlFor="comm-new" className="flex-1 cursor-pointer">
                    <span className="font-medium">Crear nueva liquidación</span>
                    {mode === 'new' && (
                      <div className="space-y-2 mt-2">
                        <div className="flex gap-2">
                          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {months.map(m => (
                                <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {years.map(y => (
                                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {existingLiquidationForPeriod && (
                          <div className={`text-sm p-2 rounded ${existingLiquidationForPeriod.status === 'draft' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-destructive/10 text-destructive'}`}>
                            {existingLiquidationForPeriod.status === 'draft'
                              ? `✓ Ya existe ${existingLiquidationForPeriod.code} en borrador. La comisión se añadirá a esta liquidación.`
                              : `⚠️ Ya existe ${existingLiquidationForPeriod.code} con estado "${existingLiquidationForPeriod.status}". Selecciona otro período.`
                            }
                          </div>
                        )}
                      </div>
                    )}
                  </Label>
                </div>

                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value="existing" id="comm-existing" className="mt-1" />
                  <Label htmlFor="comm-existing" className="flex-1 cursor-pointer">
                    <span className="font-medium">Añadir a liquidación existente</span>
                    {mode === 'existing' && (
                      <div className="mt-2">
                        {draftLiquidations.length > 0 ? (
                          <Select value={selectedLiquidationId} onValueChange={setSelectedLiquidationId}>
                            <SelectTrigger><SelectValue placeholder="Selecciona una liquidación" /></SelectTrigger>
                            <SelectContent>
                              {draftLiquidations.map(liq => (
                                <SelectItem key={liq.id} value={liq.id}>
                                  {liq.code} - {formatPeriod(liq.period_year, liq.period_month)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No hay liquidaciones en borrador para este especialista
                          </p>
                        )}
                      </div>
                    )}
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>
        )}

        {!isLoading && !noSpecialist && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={
                addMutation.isPending ||
                (mode === 'existing' && !selectedLiquidationId) ||
                (mode === 'new' && existingLiquidationForPeriod?.status !== undefined && existingLiquidationForPeriod.status !== 'draft')
              }
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Añadir a liquidación
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
