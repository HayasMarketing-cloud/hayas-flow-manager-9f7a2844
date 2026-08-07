import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Calculator, FileText, CircleDot, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SignalBadge } from './SignalBadge';
import { PhaseGroupRow } from './PhaseGroupRow';
import { formatCurrency } from '@/lib/request-utils';
import type { LensGroup } from '@/lib/projects-view-aggregation';

export const ProjectGroupCard = ({ group, defaultOpen = false }: { group: LensGroup; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  const navigate = useNavigate();
  const pct = Math.round(group.metrics.progress * 100);

  const Icon = group.kind === 'budget' ? Calculator : group.kind === 'contract' ? FileText : CircleDot;
  const originLabel = group.kind === 'budget' ? 'Presupuesto' : group.kind === 'contract' ? 'Contrato' : 'Sin origen';

  const originHref =
    group.kind === 'budget'
      ? `/presupuestos/${group.key.split(':')[1]}`
      : group.kind === 'contract'
        ? `/contratos`
        : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold truncate">{group.title}</span>
              {group.code && <span className="text-xs font-mono text-muted-foreground">{group.code}</span>}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {originLabel}
              {group.clientName ? ` · ${group.clientName}` : ''}
              {` · ${group.phases.length} ${group.phases.length === 1 ? 'fase' : 'fases'}`}
            </div>
          </div>
        </button>

        <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
          <span>{group.metrics.hours ? `${group.metrics.hours}h` : '—'}</span>
          <span title="Coste">{formatCurrency(group.metrics.cost)}</span>
          <span className="font-medium text-foreground" title="Precio">{formatCurrency(group.metrics.sale)}</span>
        </div>

        {group.metrics.overdue > 0 && (
          <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
            {group.metrics.overdue} vencidos
          </Badge>
        )}
        <SignalBadge signal={group.metrics.signal} />

        <div className="flex items-center gap-2 w-40">
          <Progress value={pct} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground w-20 text-right">
            {group.metrics.completed}/{group.metrics.total - group.metrics.cancelled} · {pct}%
          </span>
        </div>

        {originHref && (
          <Button variant="ghost" size="icon" onClick={() => navigate(originHref)} title={`Ver ${originLabel.toLowerCase()}`}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>

      {open && (
        <div className="bg-muted/20">
          {group.phases.map((p) => (
            <PhaseGroupRow key={p.key} phase={p} defaultOpen={group.phases.length === 1} />
          ))}
        </div>
      )}
    </Card>
  );
};
