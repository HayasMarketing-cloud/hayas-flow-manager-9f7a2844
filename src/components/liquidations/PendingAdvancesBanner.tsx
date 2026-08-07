import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import {
  useSpecialistPendingAdvances,
  formatAdvancePeriod,
  type PendingAdvance,
} from '@/lib/liquidation-advances';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0);

interface Props {
  specialistId?: string | null;
  /** Anticipos a excluir (p.ej. los de la propia liquidación en edición) */
  excludeItemIds?: string[];
}

/**
 * Banner informativo (nunca bloqueante) con los anticipos del especialista
 * cuyo saldo derivado no es cero.
 */
export const PendingAdvancesBanner = ({ specialistId, excludeItemIds = [] }: Props) => {
  const { data } = useSpecialistPendingAdvances(specialistId);
  const advances = (data || []).filter((a) => !excludeItemIds.includes(a.item_id));

  if (!advances.length) return null;

  const renderLine = (a: PendingAdvance) => {
    const overSettled = a.pending < 0;
    return (
      <li key={a.item_id} className="flex flex-wrap gap-x-2 gap-y-0.5">
        <span className="text-muted-foreground">
          {new Date(a.created_at).toLocaleDateString('es-ES')}
        </span>
        <span className="font-medium">{a.description}</span>
        <span className="text-muted-foreground">
          ({a.liquidation_code} · {formatAdvancePeriod(a)})
        </span>
        {a.invoice_code && (
          <span className="text-muted-foreground">· Factura {a.invoice_code}</span>
        )}
        <span>· Importe {formatCurrency(a.amount)}</span>
        <span className={overSettled ? 'text-emerald-700 font-medium' : 'font-medium'}>
          ·{' '}
          {overSettled
            ? `Regularizado en exceso — a favor del especialista ${formatCurrency(Math.abs(a.pending))}`
            : `Pendiente de regularizar ${formatCurrency(a.pending)}`}
        </span>
      </li>
    );
  };

  return (
    <Alert className="border-amber-300 bg-amber-50/60">
      <Info className="h-4 w-4 text-amber-700" />
      <AlertDescription className="text-xs text-foreground">
        <p className="font-medium mb-1 text-amber-800">
          Este especialista tiene {advances.length} anticipo(s) con saldo abierto
        </p>
        <ul className="space-y-1">{advances.map(renderLine)}</ul>
      </AlertDescription>
    </Alert>
  );
};
