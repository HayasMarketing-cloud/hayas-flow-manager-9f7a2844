import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Wallet } from 'lucide-react';
import {
  useSpecialistPendingAdvances,
  isAdvanceItem,
  type PendingAdvance,
} from '@/lib/liquidation-advances';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0);

interface Props {
  liquidationId: string;
  specialistId: string;
  /** Líneas de anticipo / regularización ya guardadas en esta liquidación */
  items: any[];
  editable: boolean;
}

export const LiquidationAdvancesSection = ({ liquidationId, specialistId, items, editable }: Props) => {
  const queryClient = useQueryClient();
  const [advDescription, setAdvDescription] = useState('');
  const [advAmount, setAdvAmount] = useState('');
  const [advInvoiceId, setAdvInvoiceId] = useState<string>('none');
  const [setAdvanceId, setSetAdvanceId] = useState<string>('');
  const [setAmount, setSetAmount] = useState('');

  const { data: pendingAdvances } = useSpecialistPendingAdvances(specialistId);
  const { data: invoices } = useQuery({
    queryKey: ['invoices-for-advance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, code, invoice_date, client:clients(name)')
        .order('invoice_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const invoiceCodeById = useMemo(() => {
    const map: Record<string, string> = {};
    (invoices || []).forEach((i: any) => { map[i.id] = i.code; });
    return map;
  }, [invoices]);

  const advancesTotal = items.reduce((s, i) => s + (Number(i.total) || 0), 0);

  const recalcSubtotal = async () => {
    const { data: allItems, error } = await supabase
      .from('liquidation_items')
      .select('total')
      .eq('liquidation_id', liquidationId);
    if (error) throw error;
    const newSubtotal = (allItems || []).reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);
    const { error: updError } = await supabase
      .from('liquidations')
      .update({ subtotal: newSubtotal, total_amount: newSubtotal })
      .eq('id', liquidationId);
    if (updError) throw updError;
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['liquidations'] });
    await queryClient.invalidateQueries({ queryKey: ['liquidation-items', liquidationId] });
    await queryClient.invalidateQueries({ queryKey: ['specialist-pending-advances'] });
  };

  const addAdvance = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(advAmount.replace(',', '.'));
      if (!advDescription.trim()) throw new Error('Indica una nota o concepto para el anticipo');
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('El importe del anticipo debe ser positivo');

      const { error } = await supabase.from('liquidation_items').insert({
        liquidation_id: liquidationId,
        financial_request_id: null,
        description: advDescription.trim(),
        quantity: 1,
        unit_price: amount,
        total: amount,
        item_type: 'advance',
        source_invoice_id: advInvoiceId === 'none' ? null : advInvoiceId,
      } as any);
      if (error) throw error;
      await recalcSubtotal();
    },
    onSuccess: async () => {
      await invalidate();
      setAdvDescription('');
      setAdvAmount('');
      setAdvInvoiceId('none');
      toast.success('Anticipo añadido');
    },
    onError: (e: any) => toast.error('Error al añadir anticipo: ' + e.message),
  });

  const addSettlement = useMutation({
    mutationFn: async () => {
      const raw = parseFloat(setAmount.replace(',', '.'));
      if (!setAdvanceId) throw new Error('Selecciona el anticipo a regularizar');
      if (!Number.isFinite(raw) || raw === 0) throw new Error('Indica un importe de regularización');
      const amount = -Math.abs(raw);
      const advance = (pendingAdvances || []).find((a) => a.item_id === setAdvanceId);

      const { error } = await supabase.from('liquidation_items').insert({
        liquidation_id: liquidationId,
        financial_request_id: null,
        description: `Regularización anticipo${advance ? ` ${advance.description}` : ''}`,
        quantity: 1,
        unit_price: amount,
        total: amount,
        item_type: 'advance_settlement',
        settles_item_id: setAdvanceId,
      } as any);
      if (error) throw error;
      await recalcSubtotal();
      return { advance, amount };
    },
    onSuccess: async (res) => {
      await invalidate();
      setSetAdvanceId('');
      setSetAmount('');
      const pending = res?.advance?.pending ?? 0;
      if (res && Math.abs(res.amount) - pending > 0.005) {
        toast.warning(
          `La regularización (${formatCurrency(Math.abs(res.amount))}) excede el saldo pendiente del anticipo (${formatCurrency(pending)}). Se ha guardado igualmente.`
        );
      } else {
        toast.success('Regularización añadida');
      }
    },
    onError: (e: any) => toast.error('Error al añadir regularización: ' + e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('liquidation_items').delete().eq('id', itemId);
      if (error) throw error;
      await recalcSubtotal();
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Línea eliminada');
    },
    onError: (e: any) =>
      toast.error(
        e.message?.includes('violates foreign key')
          ? 'No se puede eliminar: este anticipo ya tiene regularizaciones enlazadas'
          : 'Error al eliminar: ' + e.message
      ),
  });

  const exceedsWarning = useMemo(() => {
    const raw = parseFloat((setAmount || '').replace(',', '.'));
    if (!setAdvanceId || !Number.isFinite(raw)) return null;
    const advance = (pendingAdvances || []).find((a: PendingAdvance) => a.item_id === setAdvanceId);
    if (!advance) return null;
    if (Math.abs(raw) - advance.pending > 0.005) {
      return `Excede el saldo pendiente (${formatCurrency(advance.pending)}) — se permite, quedará a favor del especialista.`;
    }
    return null;
  }, [setAmount, setAdvanceId, pendingAdvances]);

  return (
    <div className="space-y-3 border rounded-md p-3">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Anticipos y regularizaciones</h4>
        {items.length > 0 && (
          <Badge variant="secondary" className="ml-auto">
            Subtotal {formatCurrency(advancesTotal)}
          </Badge>
        )}
      </div>

      {items.length > 0 && (
        <div className="divide-y border rounded-md">
          {items.map((item) => {
            const amount = Number(item.total) || 0;
            const invoiceCode = item.source_invoice_id ? invoiceCodeById[item.source_invoice_id] : null;
            return (
              <div key={item.id} className="px-3 py-2 flex items-center justify-between text-sm gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {isAdvanceItem(item) ? 'Anticipo' : 'Regularización'}
                    </Badge>
                    <span className="truncate">{item.description}</span>
                  </div>
                  {invoiceCode && (
                    <div className="text-xs text-muted-foreground mt-0.5">Factura {invoiceCode}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={amount < 0 ? 'text-destructive font-medium' : 'font-medium'}>
                    {formatCurrency(amount)}
                  </span>
                  {editable && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => deleteItem.mutate(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editable && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 border rounded-md p-3">
            <p className="text-xs font-medium">Nuevo anticipo</p>
            <div className="space-y-1">
              <Label className="text-xs">Nota / concepto</Label>
              <Input
                value={advDescription}
                onChange={(e) => setAdvDescription(e.target.value)}
                placeholder="Anticipo hito 50%"
                className="h-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Importe (€)</Label>
                <Input
                  value={advAmount}
                  onChange={(e) => setAdvAmount(e.target.value)}
                  placeholder="1500"
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Factura de origen</Label>
                <Select value={advInvoiceId} onValueChange={setAdvInvoiceId}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="none">Sin factura</SelectItem>
                    {(invoices || []).map((inv: any) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.code} — {inv.client?.name || 'Sin cliente'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              disabled={addAdvance.isPending}
              onClick={() => addAdvance.mutate()}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Añadir anticipo
            </Button>
          </div>

          <div className="space-y-2 border rounded-md p-3">
            <p className="text-xs font-medium">Regularizar anticipo</p>
            <div className="space-y-1">
              <Label className="text-xs">Anticipo</Label>
              <Select value={setAdvanceId} onValueChange={setSetAdvanceId}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Selecciona un anticipo con saldo" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {(pendingAdvances || []).map((a) => (
                    <SelectItem key={a.item_id} value={a.item_id}>
                      {a.description} · {a.liquidation_code} · pendiente {formatCurrency(a.pending)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Importe a regularizar (€)</Label>
              <Input
                value={setAmount}
                onChange={(e) => setSetAmount(e.target.value)}
                placeholder="1500"
                className="h-8"
              />
              <p className="text-[11px] text-muted-foreground">Se guardará como importe negativo.</p>
              {exceedsWarning && (
                <p className="text-[11px] text-amber-700">{exceedsWarning}</p>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              disabled={addSettlement.isPending}
              onClick={() => addSettlement.mutate()}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Añadir regularización
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
