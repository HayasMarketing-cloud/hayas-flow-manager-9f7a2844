import { Fragment } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ProjectGroup } from '@/hooks/useTrackingData';
import { MilestoneTrackingRowNested } from './MilestoneTrackingRowNested';
import { cn } from '@/lib/utils';

interface ProjectTrackingRowProps {
  group: ProjectGroup;
  isExpanded: boolean;
  onToggle: () => void;
  expandedMilestones: Set<string>;
  onToggleMilestone: (id: string) => void;
}

const statusColors = {
  pending: 'bg-yellow-500',
  in_progress: 'bg-blue-500',
  in_review: 'bg-purple-500',
  completed: 'bg-green-500',
};

const statusLabels = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  in_review: 'En Revisión',
  completed: 'Completado',
};

export function ProjectTrackingRow({ 
  group, 
  isExpanded, 
  onToggle,
  expandedMilestones,
  onToggleMilestone,
}: ProjectTrackingRowProps) {
  const progressPercent = group.stats.total > 0 
    ? Math.round((group.stats.completed / group.stats.total) * 100) 
    : 0;

  const status = group.project.status as keyof typeof statusColors || 'pending';

  return (
    <Fragment>
      {/* Project Row (Level 0) */}
      <TableRow className="bg-muted/50 hover:bg-muted/70 font-medium border-b-2">
        <TableCell className="w-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onToggle}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell colSpan={3}>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{group.project.name}</span>
          </div>
        </TableCell>
        <TableCell className="text-sm">
          {group.project.client?.name || '-'}
        </TableCell>
        <TableCell>
          {group.project.deadline && (
            <span className="text-sm">
              {new Date(group.project.deadline).toLocaleDateString('es-ES', { 
                day: '2-digit', 
                month: '2-digit' 
              })}
            </span>
          )}
        </TableCell>
        <TableCell>
          {group.project.budget?.estimated_invoice_date && (
            <span className="text-sm">
              {new Date(group.project.budget.estimated_invoice_date).toLocaleDateString('es-ES', { 
                day: '2-digit', 
                month: '2-digit' 
              })}
            </span>
          )}
        </TableCell>
        <TableCell>
          <Badge className={cn(statusColors[status], "text-white text-xs")}>
            {statusLabels[status]}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2 min-w-[120px]">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground w-10 text-right">
              {progressPercent}%
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {group.stats.completed}/{group.stats.total} hitos
          </div>
        </TableCell>
      </TableRow>

      {/* Milestones (Level 1) */}
      {isExpanded && group.milestones.map((milestone) => (
        <MilestoneTrackingRowNested
          key={milestone.id}
          milestone={milestone}
          isExpanded={expandedMilestones.has(milestone.id)}
          onToggle={() => onToggleMilestone(milestone.id)}
        />
      ))}
    </Fragment>
  );
}
