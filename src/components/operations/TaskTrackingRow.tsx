import { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  name: string;
  description: string | null;
  status: string;
  deadline: string | null;
  context_url: string | null;
}

interface TaskTrackingRowProps {
  task: Task;
  isLast: boolean;
  isSelected?: boolean;
  onSelectChange?: () => void;
}

export function TaskTrackingRow({ 
  task, 
  isLast,
  isSelected = false,
  onSelectChange,
}: TaskTrackingRowProps) {
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);
  
  const isCompleted = task.status === 'completed';

  const handleToggleComplete = async () => {
    setIsUpdating(true);
    const newStatus = isCompleted ? 'pending' : 'completed';
    
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id);

    if (error) {
      toast.error('Error al actualizar tarea');
    } else {
      queryClient.invalidateQueries({ queryKey: ['project-milestones'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
    setIsUpdating(false);
  };

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/50">
      <TableCell className="w-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelectChange?.()}
        />
      </TableCell>
      <TableCell className="w-10" />
      <TableCell colSpan={2} className="pl-16">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-px h-6 bg-border",
            isLast && "h-3"
          )} />
          <Checkbox
            checked={isCompleted}
            onCheckedChange={handleToggleComplete}
            disabled={isUpdating}
            className="data-[state=checked]:bg-green-600"
          />
          <span className={cn(
            "text-sm",
            isCompleted && "line-through text-muted-foreground"
          )}>
            {task.name}
          </span>
          {task.context_url && (
            <a
              href={task.context_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </TableCell>
      <TableCell />
      <TableCell />
      <TableCell className="text-sm text-muted-foreground">
        {task.deadline && new Date(task.deadline).toLocaleDateString('es-ES', { 
          day: '2-digit', 
          month: '2-digit' 
        })}
      </TableCell>
      <TableCell />
      <TableCell />
      <TableCell />
    </TableRow>
  );
}
