import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronDown, ChevronRight, Edit2, Trash2, Plus, Calendar, User, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { MilestoneData } from '@/hooks/useMilestonesWithTasks';
import { TasksList } from './TasksList';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  in_progress: 'bg-blue-500',
  in_review: 'bg-purple-500',
  completed: 'bg-green-500',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  in_review: 'En Revisión',
  completed: 'Completado',
};

interface SortableMilestoneItemProps {
  milestone: MilestoneData;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddTask: () => void;
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTaskComplete: (taskId: string, completed: boolean) => void;
  onReorderTasks: (taskIds: string[]) => void;
}

export function SortableMilestoneItem({
  milestone,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleTaskComplete,
  onReorderTasks,
}: SortableMilestoneItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: milestone.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const completedTasks = milestone.tasks.filter(t => t.status === 'completed').length;
  const totalTasks = milestone.tasks.length;
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const status = milestone.status || 'pending';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-card border rounded-lg transition-all',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary'
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <div className="flex items-center gap-2 p-3">
          {/* Drag handle */}
          <button
            className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted rounded"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Expand/collapse trigger */}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          {/* Milestone info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{milestone.name}</span>
              <Badge className={cn('text-xs', statusColors[status])}>
                {statusLabels[status]}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {milestone.deadline && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(milestone.deadline), 'd MMM', { locale: es })}
                </span>
              )}
              {(milestone.assignee_specialist || milestone.assignee_user) && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {milestone.assignee_specialist?.name || milestone.assignee_user?.full_name}
                </span>
              )}
              {milestone.context_url && (
                <a
                  href={milestone.context_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                  Contexto
                </a>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 w-32">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {completedTasks}/{totalTasks}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onAddTask(); }}
              title="Añadir tarea"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              title="Editar milestone"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Eliminar milestone"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-t px-3 pb-3">
            {milestone.tasks.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No hay tareas. 
                <Button variant="link" size="sm" onClick={onAddTask} className="ml-1">
                  Añadir tarea
                </Button>
              </div>
            ) : (
              <TasksList
                tasks={milestone.tasks}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
                onToggleComplete={onToggleTaskComplete}
                onReorder={onReorderTasks}
              />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
