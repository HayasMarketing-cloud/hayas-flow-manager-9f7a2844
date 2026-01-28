import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { GripVertical, Trash2, ExternalLink, ChevronDown, ChevronRight, Calendar, MessageSquare } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { TaskData } from '@/hooks/useRequestTasks';
import { cn } from '@/lib/utils';

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

interface InlineTaskItemProps {
  task: TaskData;
  specialists: { id: string; name: string }[];
  onUpdate: (updates: Partial<TaskData>) => void;
  onDelete: () => void;
  onToggleComplete: () => void;
}

export function InlineTaskItem({
  task,
  specialists,
  onUpdate,
  onDelete,
  onToggleComplete,
}: InlineTaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [localName, setLocalName] = useState(task.name);
  const [localNotes, setLocalNotes] = useState(task.notes || '');
  const [localContextUrl, setLocalContextUrl] = useState(task.context_url || '');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    setLocalName(task.name);
    setLocalNotes(task.notes || '');
    setLocalContextUrl(task.context_url || '');
  }, [task.name, task.notes, task.context_url]);

  const handleNameBlur = () => {
    setEditingField(null);
    if (localName !== task.name && localName.trim()) {
      onUpdate({ name: localName.trim() });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setLocalName(task.name);
      setEditingField(null);
    }
  };

  const handleNotesBlur = () => {
    if (localNotes !== (task.notes || '')) {
      onUpdate({ notes: localNotes || null });
    }
  };

  const handleContextUrlBlur = () => {
    if (localContextUrl !== (task.context_url || '')) {
      onUpdate({ context_url: localContextUrl || null });
    }
  };

  const isCompleted = task.status === 'completed';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group border rounded-lg bg-background transition-all',
        isDragging && 'opacity-50 shadow-lg',
        isCompleted && 'opacity-60'
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 p-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Checkbox */}
        <Checkbox
          checked={isCompleted}
          onCheckedChange={onToggleComplete}
          className="shrink-0"
        />

        {/* Expand toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="shrink-0 p-1 hover:bg-accent rounded"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Task name */}
        <div className="flex-1 min-w-0">
          {editingField === 'name' ? (
            <Input
              ref={nameInputRef}
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className="h-7 text-sm"
              autoFocus
            />
          ) : (
            <span
              onClick={() => setEditingField('name')}
              className={cn(
                'text-sm cursor-text truncate block hover:bg-accent/50 px-1 py-0.5 rounded',
                isCompleted && 'line-through text-muted-foreground'
              )}
            >
              {task.name}
            </span>
          )}
        </div>

        {/* Status badge */}
        <Select
          value={task.status || 'pending'}
          onValueChange={(value) => onUpdate({ status: value as TaskData['status'] })}
        >
          <SelectTrigger className="w-[110px] h-7 text-xs">
            <div className="flex items-center gap-1.5">
              <div className={cn('w-2 h-2 rounded-full', statusColors[task.status || 'pending'])} />
              <span className="truncate">{statusLabels[task.status || 'pending']}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(statusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', statusColors[value as keyof typeof statusColors])} />
                  {label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Deadline */}
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="date"
            value={task.deadline || ''}
            onChange={(e) => onUpdate({ deadline: e.target.value || null })}
            className="h-7 w-[120px] text-xs"
          />
        </div>

        {/* Notes indicator */}
        {task.notes && (
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        )}

        {/* Context URL */}
        {task.context_url && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => window.open(task.context_url!, '_blank')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-1 space-y-3 border-t ml-8">
          <div className="grid grid-cols-2 gap-3">
            {/* Specialist */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Especialista</label>
              <Select
                value={task.assignee_specialist_id || 'none'}
                onValueChange={(value) => 
                  onUpdate({ assignee_specialist_id: value === 'none' ? null : value })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {specialists.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Google Drive Link */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1.5">
                <img src="/src/assets/icons8-google-drive.svg" alt="Drive" className="h-4 w-4" />
                Enlace Google Drive
              </label>
              <Input
                value={localContextUrl}
                onChange={(e) => setLocalContextUrl(e.target.value)}
                onBlur={handleContextUrlBlur}
                placeholder="https://drive.google.com/..."
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notas</label>
            <Textarea
              ref={notesRef}
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Añadir notas sobre el estado..."
              className="text-sm min-h-[60px] resize-none"
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}
