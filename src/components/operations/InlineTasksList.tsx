import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Loader2 } from 'lucide-react';
import { InlineTaskItem } from './InlineTaskItem';
import { useRequestTasks, TaskData } from '@/hooks/useRequestTasks';

interface InlineTasksListProps {
  requestId: string;
  defaultSpecialistId?: string | null;
  defaultDeadline?: string | null;
  specialists: { id: string; name: string }[];
}

export function InlineTasksList({
  requestId,
  defaultSpecialistId,
  defaultDeadline,
  specialists,
}: InlineTasksListProps) {
  const {
    tasks,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    isCreating,
  } = useRequestTasks(requestId);

  const [isAdding, setIsAdding] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);

    const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);
    const updates = reorderedTasks.map((task, index) => ({
      id: task.id,
      order_index: index,
    }));
    reorderTasks(updates);
  };

  const handleAddTask = () => {
    if (!newTaskName.trim()) {
      setIsAdding(false);
      return;
    }

    createTask({
      operational_request_id: requestId,
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

  const handleUpdateTask = (taskId: string, updates: Partial<TaskData>) => {
    updateTask({ taskId, updates });
  };

  const handleToggleComplete = (task: TaskData) => {
    updateTask({
      taskId: task.id,
      updates: {
        status: task.status === 'completed' ? 'in_progress' : 'completed',
      },
    });
  };

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {completedCount}/{totalCount} tareas
          </span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{progressPercent}%</span>
        </div>
      )}

      {/* Tasks list with drag-and-drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {tasks.map((task) => (
              <InlineTaskItem
                key={task.id}
                task={task}
                specialists={specialists}
                onUpdate={(updates) => handleUpdateTask(task.id, updates)}
                onDelete={() => deleteTask(task.id)}
                onToggleComplete={() => handleToggleComplete(task)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add task inline */}
      {isAdding ? (
        <div className="flex items-center gap-2 pl-8">
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
          className="text-muted-foreground hover:text-foreground w-full justify-start"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Añadir tarea
        </Button>
      )}
    </div>
  );
}
