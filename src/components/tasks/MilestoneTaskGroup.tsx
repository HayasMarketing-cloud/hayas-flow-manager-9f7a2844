import { useState } from 'react';
import { ChevronDown, ChevronRight, Calendar, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TaskRow } from './TaskRow';
import { TaskWithDetails } from '@/hooks/useAllTasks';

interface MilestoneTaskGroupProps {
  milestoneGroup: {
    milestone: {
      id: string;
      name: string;
      status: string | null;
      deadline: string | null;
      description: string | null;
      assignee_specialist: { id: string; name: string } | null;
    };
    tasks: TaskWithDetails[];
  };
  onTaskStatusChange: (taskId: string, status: string) => void;
  isUpdating?: boolean;
}

const statusColors = {
  pending: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
  in_progress: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  in_review: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  completed: 'bg-green-500/20 text-green-700 border-green-500/30',
};

const statusLabels = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  in_review: 'En Revisión',
  completed: 'Completado',
};

export function MilestoneTaskGroup({ milestoneGroup, onTaskStatusChange, isUpdating }: MilestoneTaskGroupProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { milestone, tasks } = milestoneGroup;

  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="border rounded-lg bg-muted/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50">
            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0">
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
            <div className="flex-1 flex items-center gap-2">
              <span className="font-medium text-sm">{milestone.name}</span>
              <Badge 
                variant="outline" 
                className={statusColors[milestone.status as keyof typeof statusColors] || 'bg-gray-500/20'}
              >
                {statusLabels[milestone.status as keyof typeof statusLabels] || milestone.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                ({completedCount}/{tasks.length} tareas)
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {milestone.assignee_specialist && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {milestone.assignee_specialist.name}
                </span>
              )}
              {milestone.deadline && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(milestone.deadline).toLocaleDateString('es-ES')}
                </span>
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-1">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onStatusChange={onTaskStatusChange}
                isUpdating={isUpdating}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
