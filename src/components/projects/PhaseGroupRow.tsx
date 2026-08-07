import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { SignalBadge } from './SignalBadge';
import { RequestLensRow } from './RequestLensRow';
import type { LensPhase } from '@/lib/projects-view-aggregation';

export const PhaseGroupRow = ({ phase, defaultOpen = false }: { phase: LensPhase; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  const pct = Math.round(phase.metrics.progress * 100);

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/40 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <span className="text-sm font-medium truncate flex-1 text-left">{phase.label}</span>
        {phase.closed && (
          <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Fase cerrada
          </Badge>
        )}
        <SignalBadge signal={phase.metrics.signal} />
        <span className="text-xs text-muted-foreground w-28 text-right">
          {phase.metrics.completed}/{phase.metrics.total - phase.metrics.cancelled} · {pct}%
        </span>
        <Progress value={pct} className="w-24 h-1.5" />
      </button>

      {open && (
        <div className="pb-2 pl-6 pr-2">
          {phase.requests.map((r) => (
            <RequestLensRow key={r.id} request={r} />
          ))}
        </div>
      )}
    </div>
  );
};
