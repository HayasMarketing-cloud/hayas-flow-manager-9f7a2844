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
import { Plus } from 'lucide-react';
import { MilestoneData } from '@/hooks/useMilestonesWithTasks';
import { SortableMilestoneItem } from './SortableMilestoneItem';

interface MilestonesListProps {
  milestones: MilestoneData[];
  requestId: string;
  onAddMilestone: () => void;
  onEditMilestone: (milestoneId: string) => void;
  onDeleteMilestone: (milestoneId: string) => void;
  onAddTask: (milestoneId: string) => void;
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTaskComplete: (taskId: string, completed: boolean) => void;
  onReorderMilestones: (milestoneIds: string[]) => void;
  onReorderTasks: (taskIds: string[]) => void;
}

export function MilestonesList({
  milestones,
  requestId,
  onAddMilestone,
  onEditMilestone,
  onDeleteMilestone,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleTaskComplete,
  onReorderMilestones,
  onReorderTasks,
}: MilestonesListProps) {
  const [items, setItems] = useState(milestones);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());

  // Update items when milestones change externally
  if (milestones.length !== items.length || milestones.some((m, i) => m.id !== items[i]?.id)) {
    setItems(milestones);
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
      onReorderMilestones(newItems.map(m => m.id));
    }
  };

  const toggleExpand = (milestoneId: string) => {
    setExpandedMilestones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(milestoneId)) {
        newSet.delete(milestoneId);
      } else {
        newSet.add(milestoneId);
      }
      return newSet;
    });
  };

  if (milestones.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">
          No hay milestones para esta solicitud
        </p>
        <Button variant="outline" size="sm" onClick={onAddMilestone}>
          <Plus className="h-4 w-4 mr-2" />
          Añadir Milestone
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map(m => m.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((milestone) => (
            <SortableMilestoneItem
              key={milestone.id}
              milestone={milestone}
              isExpanded={expandedMilestones.has(milestone.id)}
              onToggleExpand={() => toggleExpand(milestone.id)}
              onEdit={() => onEditMilestone(milestone.id)}
              onDelete={() => onDeleteMilestone(milestone.id)}
              onAddTask={() => onAddTask(milestone.id)}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onToggleTaskComplete={onToggleTaskComplete}
              onReorderTasks={onReorderTasks}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button variant="ghost" size="sm" onClick={onAddMilestone} className="w-full mt-2">
        <Plus className="h-4 w-4 mr-2" />
        Añadir Milestone
      </Button>
    </div>
  );
}
