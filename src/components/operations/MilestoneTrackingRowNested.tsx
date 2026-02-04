import { useState, Fragment, useRef, useEffect } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, ExternalLink, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MilestoneWithDetails, useUpdateMilestoneStatus, useUpdateMilestone } from '@/hooks/useProjectMilestones';
import { TaskTrackingRow } from './TaskTrackingRow';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MilestoneTrackingRowNestedProps {
  milestone: MilestoneWithDetails;
  isExpanded: boolean;
  onToggle: () => void;
  isSelected?: boolean;
  onSelectChange?: () => void;
  selectedTaskIds?: string[];
  onTaskSelectChange?: (taskId: string) => void;
}

const statusLabels = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  in_review: 'En Revisión',
  completed: 'Completado',
};

export function MilestoneTrackingRowNested({ 
  milestone, 
  isExpanded, 
  onToggle,
  isSelected = false,
  onSelectChange,
  selectedTaskIds = [],
  onTaskSelectChange,
}: MilestoneTrackingRowNestedProps) {
  const queryClient = useQueryClient();
  const updateStatusMutation = useUpdateMilestoneStatus();
  const updateMilestoneMutation = useUpdateMilestone();
  
  const [localStatus, setLocalStatus] = useState(milestone.status || 'pending');
  const [localSpecialistId, setLocalSpecialistId] = useState(milestone.assignee_specialist_id || '');
  const [localDeadline, setLocalDeadline] = useState(milestone.deadline?.split('T')[0] || '');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const taskInputRef = useRef<HTMLInputElement>(null);
  
  const taskCount = milestone.tasks?.length || 0;
  const completedTasks = milestone.tasks?.filter(t => t.status === 'completed').length || 0;
  
  // Fetch specialists list for the dropdown
  const { data: specialists = [] } = useQuery({
    queryKey: ['specialists-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Fetch full task details when expanded
  const { data: tasks, isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
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

  // Focus input when creating task
  useEffect(() => {
    if (isCreatingTask && taskInputRef.current) {
      taskInputRef.current.focus();
    }
  }, [isCreatingTask]);

  const handleStatusChange = (newStatus: string) => {
    setLocalStatus(newStatus);
    updateStatusMutation.mutate({ milestoneId: milestone.id, status: newStatus });
  };

  const handleSpecialistChange = (specialistId: string) => {
    const newValue = specialistId === 'none' ? null : specialistId;
    setLocalSpecialistId(newValue || '');
    updateMilestoneMutation.mutate({ 
      milestoneId: milestone.id, 
      updates: { assignee_specialist_id: newValue } 
    });
  };

  const handleDeadlineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value || null;
    setLocalDeadline(e.target.value);
    updateMilestoneMutation.mutate({ 
      milestoneId: milestone.id, 
      updates: { deadline: newValue } 
    });
  };

  const handleCreateTask = async () => {
    if (!newTaskName.trim()) {
      setIsCreatingTask(false);
      return;
    }

    setIsSubmitting(true);
    try {
      // Get max order_index
      const { data: existingTasks } = await supabase
        .from('tasks')
        .select('order_index')
        .eq('operational_request_id', milestone.id)
        .order('order_index', { ascending: false })
        .limit(1);

      const maxOrder = existingTasks?.[0]?.order_index ?? -1;

      const { error } = await supabase
        .from('tasks')
        .insert({
          name: newTaskName.trim(),
          operational_request_id: milestone.id,
          assignee_specialist_id: milestone.assignee_specialist_id,
          deadline: milestone.deadline,
          status: 'pending',
          order_index: maxOrder + 1,
        });

      if (error) throw error;

      toast.success('Tarea creada');
      setNewTaskName('');
      setIsCreatingTask(false);
      
      // Refresh task counts and list
      queryClient.invalidateQueries({ queryKey: ['milestone-tasks', milestone.id] });
      queryClient.invalidateQueries({ queryKey: ['project-milestones'] });
      refetchTasks();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTaskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCreateTask();
    } else if (e.key === 'Escape') {
      setIsCreatingTask(false);
      setNewTaskName('');
    }
  };

  const isOverdue = milestone.deadline && new Date(milestone.deadline) < new Date() && milestone.status !== 'completed';

  return (
    <Fragment>
      <TableRow className="hover:bg-muted/30 border-b border-border/50">
        <TableCell className="w-10">
          {onSelectChange && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelectChange}
            />
          )}
        </TableCell>
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
        
        {/* Specialist - Inline Select */}
        <TableCell>
          <Select 
            value={localSpecialistId || 'none'} 
            onValueChange={handleSpecialistChange}
          >
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar</SelectItem>
              {specialists.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        
        {/* Deadline - Inline Date Input */}
        <TableCell>
          <Input
            type="date"
            value={localDeadline}
            onChange={handleDeadlineChange}
            className={cn(
              "h-7 w-[120px] text-xs",
              isOverdue && "border-destructive text-destructive"
            )}
          />
        </TableCell>
        
        <TableCell />
        
        {/* Status - Inline Select */}
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
        
        {/* Tasks count + Create button */}
        <TableCell>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {completedTasks}/{taskCount}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsCreatingTask(true)}
              title="Añadir tarea"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Inline task creation row */}
      {isCreatingTask && (
        <TableRow className="bg-muted/20">
          <TableCell className="w-10" />
          <TableCell className="w-10" />
          <TableCell colSpan={7} className="pl-16">
            <div className="flex items-center gap-2 py-1">
              <Input
                ref={taskInputRef}
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={handleTaskKeyDown}
                placeholder="Nombre de la nueva tarea..."
                className="h-8 flex-1 max-w-md"
                disabled={isSubmitting}
              />
              <Button
                size="sm"
                onClick={handleCreateTask}
                disabled={!newTaskName.trim() || isSubmitting}
                className="h-8"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setIsCreatingTask(false);
                  setNewTaskName('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      )}

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
              isSelected={selectedTaskIds.includes(task.id)}
              onSelectChange={onTaskSelectChange ? () => onTaskSelectChange(task.id) : undefined}
            />
          ))
        ) : null
      )}
    </Fragment>
  );
}
