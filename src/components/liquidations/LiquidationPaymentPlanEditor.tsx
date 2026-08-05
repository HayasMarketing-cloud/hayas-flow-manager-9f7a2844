import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/liquidation-utils';
import {
  LiquidationPaymentMilestone,
  getLiquidationMilestoneAmount,
} from '@/lib/liquidation-payment-plan';

interface Props {
  value: LiquidationPaymentMilestone[];
  onChange: (next: LiquidationPaymentMilestone[]) => void;
  disabled?: boolean;
  /** Total de la liquidación, usado como base */
  total?: number;
}

export const LiquidationPaymentPlanEditor = ({ value, onChange, disabled, total = 0 }: Props) => {
  const milestones = value ?? [];
  const sumAmount = milestones.reduce((s, m) => s + getLiquidationMilestoneAmount(m, total), 0);
  const paidAmount = milestones
    .filter((m) => m.paid)
    .reduce((s, m) => s + getLiquidationMilestoneAmount(m, total), 0);

  const valid = milestones.length === 0 || Math.abs(sumAmount - total) < 0.01;

  const update = (idx: number, patch: Partial<LiquidationPaymentMilestone>) => {
    onChange(milestones.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const add = () => {
    const remainingPct = Math.max(
      0,
      100 - milestones.reduce((s, m) => s + (Number(m.percentage) || 0), 0)
    );
    onChange([
      ...milestones,
      {
        label: `Pago ${milestones.length + 1}`,
        percentage: remainingPct,
        amount: null,
        payment_date: '',
        paid: false,
        paid_at: null,
      },
    ]);
  };

  const remove = (idx: number) => onChange(milestones.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Plan de Pagos (opcional)</Label>
          <p className="text-xs text-muted-foreground">
            Divide el cobro de esta liquidación en varios pagos. El devengo sigue siendo del periodo
            de la liquidación; sólo cambia la fecha en la que se paga cada parte.
          </p>
        </div>
        {!disabled && (
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus className="h-4 w-4 mr-1" /> Pago
          </Button>
        )}
      </div>

      {milestones.length > 0 && (
        <div className="space-y-3">
          {milestones.map((m, i) => {
            const amount = getLiquidationMilestoneAmount(m, total);
            return (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_90px_140px_160px_40px] gap-2 items-end">
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
                    <Label className="text-xs">%</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={m.percentage}
                      onChange={(e) =>
                        update(i, { percentage: Number(e.target.value), amount: null })
                      }
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Importe</Label>
                    <Input
                      type="number"
                      step={0.01}
                      value={m.amount ?? Number(amount.toFixed(2))}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        const pct = val != null && total > 0 ? (val / total) * 100 : m.percentage;
                        update(i, { amount: val, percentage: Number(pct.toFixed(4)) });
                      }}
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Fecha de pago</Label>
                    <Input
                      type="date"
                      value={m.payment_date}
                      onChange={(e) => update(i, { payment_date: e.target.value })}
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

                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={!!m.paid}
                      onCheckedChange={(checked) =>
                        update(i, {
                          paid: !!checked,
                          paid_at: checked ? new Date().toISOString() : null,
                        })
                      }
                      disabled={disabled}
                    />
                    Pagado
                  </label>
                  <div className="text-xs text-muted-foreground">
                    {m.percentage}% de {formatCurrency(total)} ={' '}
                    <strong>{formatCurrency(amount)}</strong>
                  </div>
                </div>
              </div>
            );
          })}

          <div
            className={`text-xs font-medium ${valid ? 'text-muted-foreground' : 'text-destructive'}`}
          >
            Suma: {formatCurrency(sumAmount)} / {formatCurrency(total)}{' '}
            {valid ? '✓' : '— debe coincidir con el total de la liquidación'} · Pagado:{' '}
            {formatCurrency(paidAmount)}
          </div>
        </div>
      )}
    </div>
  );
};
