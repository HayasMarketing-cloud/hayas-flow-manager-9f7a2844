import { useState } from 'react';
import { ChevronDown, ChevronRight, Calendar, User, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useRequestTasks, TaskData } from '@/hooks/useRequestTasks';
import { cn } from '@/lib/utils';

interface MilestoneTasksExpandedProps {
  milestoneId: string;
  defaultSpecialistId?: string | null;
  defaultDeadline?: string | null;
}

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

export function MilestoneTasksExpanded({
  milestoneId,
  defaultSpecialistId,
  defaultDeadline,
}: MilestoneTasksExpandedProps) {
  const { 
    tasks, 
    isLoading, 
    createTask, 
    updateTask,
    isCreating,
    isUpdating,
  } = useRequestTasks(milestoneId);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');

  const handleAddTask = () => {
    if (!newTaskName.trim()) {
      setIsAdding(false);
      return;
    }

    createTask({
      operational_request_id: milestoneId,
      name: newTaskName.trim(),
      assignee_specialist_id: defaultSpecialistId || null,
      deadline: defaultDeadline || null,
      status: 'pending',
    });

    setNewTaskName('');
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTask();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewTaskName('');
    }
  };

  const handleToggleComplete = (task: TaskData) => {
    updateTask({
      taskId: task.id,
      updates: {
        status: task.status === 'completed' ? 'in_progress' : 'completed',
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 pl-12 space-y-2">
      {tasks.length === 0 && !isAdding ? (
        <div className="text-sm text-muted-foreground py-2">
          No hay tareas en este milestone
        </div>
      ) : (
        <div className="space-y-1">
          {tasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isOverdue = task.deadline && new Date(task.deadline) < new Date() && !isCompleted;
            
            return (
              <div 
                key={task.id}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-md hover:bg-background transition-colors',
                  isOverdue && 'bg-destructive/5'
                )}
              >
                <Checkbox
                  checked={isCompleted}
                  disabled={isUpdating}
                  onCheckedChange={() => handleToggleComplete(task)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      'text-sm',
                      isCompleted && 'line-through text-muted-foreground'
                    )}>
                      {task.name}
                    </span>
                    <Badge className={cn('text-xs', statusColors[task.status] || 'bg-gray-500')}>
                      {statusLabels[task.status] || task.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  {task.assignee_specialist && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {task.assignee_specialist.name}
                    </span>
                  )}
                  {task.deadline && (
                    <span className={cn(
                      'flex items-center gap-1',
                      isOverdue && 'text-destructive font-medium'
                    )}>
                      <Calendar className="h-3 w-3" />
                      {new Date(task.deadline).toLocaleDateString('es-ES')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add task inline */}
      {isAdding ? (
        <div className="flex items-center gap-2 pt-2">
          <Input
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleAddTask}
            placeholder="Nombre de la tarea..."
            className="h-8 text-sm"
            autoFocus
            disabled={isCreating}
          />
          {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Añadir tarea
        </Button>
      )}
    </div>
  );
}
