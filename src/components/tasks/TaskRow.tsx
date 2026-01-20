import { Calendar, ExternalLink, User } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TaskWithDetails } from '@/hooks/useAllTasks';

interface TaskRowProps {
  task: TaskWithDetails;
  onStatusChange: (taskId: string, status: string) => void;
  isUpdating?: boolean;
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

export function TaskRow({ task, onStatusChange, isUpdating }: TaskRowProps) {
  const isCompleted = task.status === 'completed';
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && !isCompleted;

  return (
    <div className={`flex items-start gap-3 p-2 rounded-md hover:bg-background transition-colors ${isOverdue ? 'bg-destructive/5' : ''}`}>
      <Checkbox
        checked={isCompleted}
        disabled={isUpdating}
        onCheckedChange={(checked) => {
          onStatusChange(task.id, checked ? 'completed' : 'in_progress');
        }}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm ${isCompleted ? 'line-through text-muted-foreground' : 'font-medium'}`}>
            {task.name}
          </span>
          <Badge 
            className={`text-xs ${statusColors[task.status as keyof typeof statusColors] || 'bg-gray-500'}`}
          >
            {statusLabels[task.status as keyof typeof statusLabels] || task.status}
          </Badge>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {task.assignee_specialist && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.assignee_specialist.name}
            </span>
          )}
          {task.assignee_user && !task.assignee_specialist && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.assignee_user.full_name}
            </span>
          )}
          {task.deadline && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-destructive font-medium' : ''}`}>
              <Calendar className="h-3 w-3" />
              {new Date(task.deadline).toLocaleDateString('es-ES')}
              {isOverdue && ' (Vencida)'}
            </span>
          )}
          {task.context_url && (
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
              <a href={task.context_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Ver contexto
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
