import { Fragment, useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProjectGroup } from '@/hooks/useTrackingData';
import { MilestoneTrackingRowNested } from './MilestoneTrackingRowNested';
import { useUpdateProjectField } from '@/hooks/useOperationalProjects';
import { cn } from '@/lib/utils';

interface ProjectTrackingRowProps {
  group: ProjectGroup;
  isExpanded: boolean;
  onToggle: () => void;
  expandedMilestones: Set<string>;
  onToggleMilestone: (id: string) => void;
  isSelected?: boolean;
  onSelectChange?: () => void;
  selectedMilestoneIds?: string[];
  onMilestoneSelectChange?: (id: string) => void;
  selectedTaskIds?: string[];
  onTaskSelectChange?: (id: string) => void;
}

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
  isSelected = false,
  onSelectChange,
  selectedMilestoneIds = [],
  onMilestoneSelectChange,
  selectedTaskIds = [],
  onTaskSelectChange,
}: ProjectTrackingRowProps) {
  const updateFieldMutation = useUpdateProjectField();
  
  const [localStatus, setLocalStatus] = useState(group.project.status || 'pending');
  const [localDeadline, setLocalDeadline] = useState(group.project.deadline?.split('T')[0] || '');

  const progressPercent = group.stats.total > 0 
    ? Math.round((group.stats.completed / group.stats.total) * 100) 
    : 0;

  const status = group.project.status as keyof typeof statusLabels || 'pending';

  const handleStatusChange = (newStatus: string) => {
    setLocalStatus(newStatus);
    updateFieldMutation.mutate({
      projectId: group.project.id,
      field: 'status',
      value: newStatus,
    });
  };

  const handleDeadlineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value || null;
    setLocalDeadline(e.target.value);
    updateFieldMutation.mutate({
      projectId: group.project.id,
      field: 'deadline',
      value: newValue,
    });
  };

  const isOverdue = group.project.deadline && 
    new Date(group.project.deadline) < new Date() && 
    group.project.status !== 'completed';

  return (
    <Fragment>
      {/* Project Row (Level 0) */}
      <TableRow className="bg-muted/50 hover:bg-muted/70 font-medium border-b-2">
        <TableCell className="w-10">
          {onSelectChange && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelectChange}
            />
          )}
        </TableCell>
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
        
        {/* Deadline - Inline Date Input */}
        <TableCell>
          <Input
            type="date"
            value={localDeadline}
            onChange={handleDeadlineChange}
            className={cn(
              "h-7 w-[120px] text-xs",
              isOverdue && "border-destructive text-destructive"
            )}
          />
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
        
        {/* Status - Inline Select */}
        <TableCell>
          <Select value={localStatus} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-7 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in_progress">En Progreso</SelectItem>
              <SelectItem value="in_review">En Revisión</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
            </SelectContent>
          </Select>
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
          isSelected={selectedMilestoneIds.includes(milestone.id)}
          onSelectChange={onMilestoneSelectChange ? () => onMilestoneSelectChange(milestone.id) : undefined}
          selectedTaskIds={selectedTaskIds}
          onTaskSelectChange={onTaskSelectChange}
        />
       ))}
    </Fragment>
  );
}
