import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Signal } from '@/lib/projects-view-aggregation';

const MAP: Record<Signal, { label: string; className: string }> = {
  overdue: { label: 'Vencido', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  due_soon: { label: 'Próximo', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  ok: { label: 'En plazo', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  none: { label: 'Sin fecha', className: 'bg-muted text-muted-foreground border-border' },
};

export const SignalBadge = ({ signal, className }: { signal: Signal; className?: string }) => {
  const cfg = MAP[signal];
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', cfg.className, className)}>
      {cfg.label}
    </Badge>
  );
};
