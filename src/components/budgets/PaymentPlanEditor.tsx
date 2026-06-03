import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

export interface PaymentMilestone {
  label: string;
  percentage: number;
  invoice_date: string; // YYYY-MM-DD
}

interface PaymentPlanEditorProps {
  value: PaymentMilestone[];
  onChange: (next: PaymentMilestone[]) => void;
  disabled?: boolean;
}

export const PaymentPlanEditor = ({ value, onChange, disabled }: PaymentPlanEditorProps) => {
  const milestones = value ?? [];
  const sumPct = milestones.reduce((s, m) => s + (Number(m.percentage) || 0), 0);
  const valid = milestones.length === 0 || sumPct === 100;

  const update = (idx: number, patch: Partial<PaymentMilestone>) => {
    onChange(milestones.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const add = () => {
    const remaining = Math.max(0, 100 - sumPct);
    onChange([...milestones, { label: `Hito ${milestones.length + 1}`, percentage: remaining, invoice_date: '' }]);
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
          </p>
        </div>
        {!disabled && (
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus className="h-4 w-4 mr-1" /> Hito
          </Button>
        )}
      </div>

      {milestones.length > 0 && (
        <div className="space-y-2">
          {milestones.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_160px_40px] gap-2 items-end">
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
                  onChange={(e) => update(i, { percentage: Number(e.target.value) })}
                  disabled={disabled}
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
              ) : <div />}
            </div>
          ))}

          <div className={`text-xs font-medium ${valid ? 'text-muted-foreground' : 'text-destructive'}`}>
            Suma: {sumPct}% {valid ? '✓' : '— debe sumar 100%'}
          </div>
        </div>
      )}
    </div>
  );
};
