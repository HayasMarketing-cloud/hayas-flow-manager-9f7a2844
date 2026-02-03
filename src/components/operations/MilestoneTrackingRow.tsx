import { Fragment } from 'react';
import { ChevronDown, ChevronRight, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MilestoneWithDetails } from '@/hooks/useProjectMilestones';
import { MilestoneTasksExpanded } from './MilestoneTasksExpanded';
import { cn } from '@/lib/utils';

interface MilestoneTrackingRowProps {
  milestone: MilestoneWithDetails;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusChange: (milestoneId: string, status: string) => void;
  isUpdating?: boolean;
}

const statusColors = {
  pending: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
  in_progress: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  in_review: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  completed: 'bg-green-500/20 text-green-700 border-green-500/30',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  in_review: 'En Revisión',
  completed: 'Completado',
};

export function MilestoneTrackingRow({
  milestone,
  isExpanded,
  onToggle,
  onStatusChange,
  isUpdating,
}: MilestoneTrackingRowProps) {
  const project = milestone.operational_project;
  const budget = project?.budget;
  const contract = project?.contract;
  
  const completedTasks = milestone.tasks?.filter(t => t.status === 'completed').length || 0;
  const totalTasks = milestone.tasks?.length || 0;
  
  const isOverdue = milestone.deadline && new Date(milestone.deadline) < new Date() && milestone.status !== 'completed';
  const isUpcoming = milestone.deadline && !isOverdue && (() => {
    const deadline = new Date(milestone.deadline);
    const now = new Date();
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays > 0;
  })();

  return (
    <Fragment>
      <TableRow 
        className={cn(
          'cursor-pointer hover:bg-muted/50',
          isOverdue && 'bg-destructive/5'
        )}
        onClick={onToggle}
      >
        <TableCell>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className="font-medium">
          {milestone.client?.name || project?.client?.name || '-'}
        </TableCell>
        <TableCell>{project?.name || '-'}</TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium">{milestone.name}</span>
            {milestone.description && (
              <span className="text-xs text-muted-foreground line-clamp-1">
                {milestone.description}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          {budget?.code ? (
            <Badge variant="outline" className="font-mono text-xs">
              {budget.code}
            </Badge>
          ) : '-'}
        </TableCell>
        <TableCell>
          {contract?.code ? (
            <Badge variant="outline" className="font-mono text-xs">
              {contract.code}
            </Badge>
          ) : '-'}
        </TableCell>
        <TableCell>
          {milestone.assignee_specialist ? (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">{milestone.assignee_specialist.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>
          {milestone.deadline ? (
            <div className={cn(
              'flex items-center gap-1.5 text-sm',
              isOverdue && 'text-destructive font-medium',
              isUpcoming && 'text-orange-600 font-medium'
            )}>
              <Calendar className="h-3.5 w-3.5" />
              {new Date(milestone.deadline).toLocaleDateString('es-ES')}
              {isOverdue && <span className="text-xs">(Vencido)</span>}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>
          {budget?.estimated_invoice_date ? (
            <span className="text-sm">
              {new Date(budget.estimated_invoice_date).toLocaleDateString('es-ES')}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Select
            value={milestone.status || 'pending'}
            onValueChange={(value) => onStatusChange(milestone.id, value)}
            disabled={isUpdating}
          >
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">
                <Badge variant="outline" className={statusColors.pending}>
                  Pendiente
                </Badge>
              </SelectItem>
              <SelectItem value="in_progress">
                <Badge variant="outline" className={statusColors.in_progress}>
                  En Progreso
                </Badge>
              </SelectItem>
              <SelectItem value="in_review">
                <Badge variant="outline" className={statusColors.in_review}>
                  En Revisión
                </Badge>
              </SelectItem>
              <SelectItem value="completed">
                <Badge variant="outline" className={statusColors.completed}>
                  Completado
                </Badge>
              </SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all"
                style={{ width: totalTasks > 0 ? `${(completedTasks / totalTasks) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {completedTasks}/{totalTasks}
            </span>
          </div>
        </TableCell>
      </TableRow>
      
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={11} className="bg-muted/30 p-0">
            <MilestoneTasksExpanded 
              milestoneId={milestone.id}
              defaultSpecialistId={milestone.assignee_specialist_id}
              defaultDeadline={milestone.deadline}
            />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
