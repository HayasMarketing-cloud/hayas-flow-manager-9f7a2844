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
import { TaskData } from '@/hooks/useMilestonesWithTasks';
import { SortableTaskItem } from './SortableTaskItem';

interface TasksListProps {
  tasks: TaskData[];
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onReorder: (taskIds: string[]) => void;
}

export function TasksList({
  tasks,
  onEditTask,
  onDeleteTask,
  onToggleComplete,
  onReorder,
}: TasksListProps) {
  const [items, setItems] = useState(tasks);

  // Update items when tasks change externally
  if (tasks.length !== items.length || tasks.some((t, i) => t.id !== items[i]?.id)) {
    setItems(tasks);
  }

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

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      onReorder(newItems.map(t => t.id));
    }
  };

  return (
    <div className="mt-2 space-y-0.5">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((task) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              onEdit={() => onEditTask(task.id)}
              onDelete={() => onDeleteTask(task.id)}
              onToggleComplete={(completed) => onToggleComplete(task.id, completed)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
