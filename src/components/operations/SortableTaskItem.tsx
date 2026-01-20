import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit2, Trash2, Calendar, User, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { TaskData } from '@/hooks/useMilestonesWithTasks';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  in_progress: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  in_review: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
  completed: 'bg-green-500/20 text-green-700 dark:text-green-400',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  in_review: 'En Revisión',
  completed: 'Completado',
};

interface SortableTaskItemProps {
  task: TaskData;
  onEdit: () => void;
  onDelete: () => void;
  onToggleComplete: (completed: boolean) => void;
}

export function SortableTaskItem({
  task,
  onEdit,
  onDelete,
  onToggleComplete,
}: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCompleted = task.status === 'completed';
  const status = task.status || 'pending';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 py-2 px-2 rounded-md transition-all group hover:bg-muted/50',
        isDragging && 'opacity-50 shadow-md ring-1 ring-primary bg-muted',
        isCompleted && 'opacity-60'
      )}
    >
      {/* Drag handle */}
      <button
        className="cursor-grab active:cursor-grabbing touch-none p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>

      {/* Checkbox */}
      <Checkbox
        checked={isCompleted}
        onCheckedChange={(checked) => onToggleComplete(checked as boolean)}
        className="h-4 w-4"
      />

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm truncate', isCompleted && 'line-through text-muted-foreground')}>
            {task.name}
          </span>
          {!isCompleted && (
            <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', statusColors[status])}>
              {statusLabels[status]}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
          {task.deadline && (
            <span className="flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" />
              {format(new Date(task.deadline), 'd MMM', { locale: es })}
            </span>
          )}
          {(task.assignee_specialist || task.assignee_user) && (
            <span className="flex items-center gap-0.5">
              <User className="h-2.5 w-2.5" />
              {task.assignee_specialist?.name || task.assignee_user?.full_name}
            </span>
          )}
          {task.context_url && (
            <a
              href={task.context_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 hover:text-primary"
            >
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onEdit}
          title="Editar tarea"
        >
          <Edit2 className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Eliminar tarea"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
