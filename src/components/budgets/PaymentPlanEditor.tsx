import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency, getMilestoneAmount, getMilestoneBase } from '@/lib/budget-utils';

export interface PaymentMilestone {
  label: string;
  percentage: number;
  invoice_date: string; // YYYY-MM-DD
  /** PO Number / referencia de cliente al que pertenece este hito (opcional) */
  po_number?: string | null;
  /** Base de cálculo propia (p.ej. importe del PO). Si es null, se usa el total del presupuesto */
  base_amount?: number | null;
  /** Importe fijado manualmente. Si existe, manda sobre base × % */
  amount?: number | null;
}

interface PaymentPlanEditorProps {
  value: PaymentMilestone[];
  onChange: (next: PaymentMilestone[]) => void;
  disabled?: boolean;
  /** Total del presupuesto, usado como base por defecto */
  budgetTotal?: number;
}

export const PaymentPlanEditor = ({ value, onChange, disabled, budgetTotal = 0 }: PaymentPlanEditorProps) => {
  const milestones = value ?? [];
  const usesBases = milestones.some((m) => m.base_amount != null || m.amount != null);
  const sumPct = milestones.reduce((s, m) => s + (Number(m.percentage) || 0), 0);
  const sumAmount = milestones.reduce((s, m) => s + getMilestoneAmount(m, budgetTotal), 0);

  const valid =
    milestones.length === 0 ||
    (usesBases ? Math.abs(sumAmount - budgetTotal) < 0.01 : sumPct === 100);

  const update = (idx: number, patch: Partial<PaymentMilestone>) => {
    onChange(milestones.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const add = () => {
    const remaining = Math.max(0, 100 - sumPct);
    onChange([
      ...milestones,
      {
        label: `Hito ${milestones.length + 1}`,
        percentage: remaining,
        invoice_date: '',
        po_number: null,
        base_amount: null,
        amount: null,
      },
    ]);
  };

  const remove = (idx: number) => {
    onChange(milestones.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Plan de Pagos (opcional)</Label>
          <p className="text-xs text-muted-foreground">
            Si está vacío, se usará la Fecha Estimada de Facturación como hito único (100%).
            Puedes indicar un PO Number y su base propia: el % se calcula sobre esa base, no sobre el total.
          </p>
        </div>
        {!disabled && (
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus className="h-4 w-4 mr-1" /> Hito
          </Button>
        )}
      </div>

      {milestones.length > 0 && (
        <div className="space-y-3">
          {milestones.map((m, i) => {
            const base = getMilestoneBase(m, budgetTotal);
            const amount = getMilestoneAmount(m, budgetTotal);
            return (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_160px_40px] gap-2 items-end">
                  <div>
                    <Label className="text-xs">Concepto</Label>
                    <Input
                      value={m.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                      disabled={disabled}
                      placeholder="Anticipo 50%"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">PO Number / Ref.</Label>
                    <Input
                      value={m.po_number ?? ''}
                      onChange={(e) => update(i, { po_number: e.target.value || null })}
                      disabled={disabled}
                      placeholder="PO-12345"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Fecha facturación</Label>
                    <Input
                      type="date"
                      value={m.invoice_date}
                      onChange={(e) => update(i, { invoice_date: e.target.value })}
                      disabled={disabled}
                    />
                  </div>
                  {!disabled ? (
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[160px_100px_160px_1fr] gap-2 items-end">
                  <div>
                    <Label className="text-xs">Base de cálculo</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={m.base_amount ?? ''}
                      onChange={(e) =>
                        update(i, {
                          base_amount: e.target.value === '' ? null : Number(e.target.value),
                          amount: null,
                        })
                      }
                      disabled={disabled}
                      placeholder={String(budgetTotal || 0)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">%</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={m.percentage}
                      onChange={(e) => update(i, { percentage: Number(e.target.value), amount: null })}
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Importe a facturar</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={m.amount ?? Number(amount.toFixed(2))}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        const pct = val != null && base > 0 ? (val / base) * 100 : m.percentage;
                        update(i, { amount: val, percentage: Number(pct.toFixed(4)) });
                      }}
                      disabled={disabled}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground pb-2">
                    {m.percentage}% sobre {formatCurrency(base)} = <strong>{formatCurrency(amount)}</strong>
                    {m.base_amount == null && m.amount == null && ' (base: total del presupuesto)'}
                  </div>
                </div>
              </div>
            );
          })}

          <div className={`text-xs font-medium ${valid ? 'text-muted-foreground' : 'text-destructive'}`}>
            {usesBases ? (
              <>
                Suma importes: {formatCurrency(sumAmount)} / {formatCurrency(budgetTotal)}{' '}
                {valid ? '✓' : '— debe coincidir con el total del presupuesto'}
              </>
            ) : (
              <>
                Suma: {sumPct}% {valid ? '✓' : '— debe sumar 100%'}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
