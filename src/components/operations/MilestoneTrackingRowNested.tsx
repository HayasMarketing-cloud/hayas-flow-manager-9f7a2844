import { useState, Fragment } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MilestoneWithDetails, useUpdateMilestoneStatus } from '@/hooks/useProjectMilestones';
import { TaskTrackingRow } from './TaskTrackingRow';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface MilestoneTrackingRowNestedProps {
  milestone: MilestoneWithDetails;
  isExpanded: boolean;
  onToggle: () => void;
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

export function MilestoneTrackingRowNested({ 
  milestone, 
  isExpanded, 
  onToggle 
}: MilestoneTrackingRowNestedProps) {
  const updateStatusMutation = useUpdateMilestoneStatus();
  const [localStatus, setLocalStatus] = useState(milestone.status || 'pending');
  
  const taskCount = milestone.tasks?.length || 0;
  const completedTasks = milestone.tasks?.filter(t => t.status === 'completed').length || 0;
  
  // Fetch full task details when expanded
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['milestone-tasks', milestone.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, name, description, status, deadline, context_url')
        .eq('operational_request_id', milestone.id)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isExpanded && taskCount > 0,
  });

  const handleStatusChange = (newStatus: string) => {
    setLocalStatus(newStatus);
    updateStatusMutation.mutate({ milestoneId: milestone.id, status: newStatus });
  };

  const isOverdue = milestone.deadline && new Date(milestone.deadline) < new Date() && milestone.status !== 'completed';

  return (
    <Fragment>
      <TableRow className="hover:bg-muted/30 border-b border-border/50">
        <TableCell className="w-10" />
        <TableCell className="w-10">
          {taskCount > 0 && (
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
          )}
        </TableCell>
        <TableCell colSpan={2} className="pl-8">
          <div className="flex items-center gap-2">
            <span className="font-medium">{milestone.name}</span>
            {milestone.context_url && (
              <a
                href={milestone.context_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {milestone.assignee_specialist?.name || '-'}
        </TableCell>
        <TableCell>
          <span className={cn(
            "text-sm",
            isOverdue && "text-destructive font-medium"
          )}>
            {milestone.deadline 
              ? new Date(milestone.deadline).toLocaleDateString('es-ES', { 
                  day: '2-digit', 
                  month: '2-digit' 
                })
              : '-'
            }
          </span>
        </TableCell>
        <TableCell />
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
          {taskCount > 0 ? (
            <Badge variant="outline" className="text-xs">
              {completedTasks}/{taskCount}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </TableCell>
      </TableRow>

      {/* Tasks (Level 2) */}
      {isExpanded && (
        tasksLoading ? (
          <TableRow className="bg-muted/30">
            <TableCell colSpan={10} className="py-2">
              <div className="flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </TableCell>
          </TableRow>
        ) : tasks && tasks.length > 0 ? (
          tasks.map((task, idx) => (
            <TaskTrackingRow 
              key={task.id} 
              task={task} 
              isLast={idx === tasks.length - 1}
            />
          ))
        ) : null
      )}
    </Fragment>
  );
}
