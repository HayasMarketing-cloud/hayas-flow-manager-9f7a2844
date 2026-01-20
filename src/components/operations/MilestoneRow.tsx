import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronRight, 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  ExternalLink, 
  MessageSquare,
  CheckCircle2 
} from 'lucide-react';
import { InlineTasksList } from './InlineTasksList';
import { useUpdateRequestNotes, useRequestTasks } from '@/hooks/useRequestTasks';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

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

interface OperationalRequest {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  status: string;
  deadline: string | null;
  context_url: string | null;
  assignee_specialist_id: string | null;
  assignee_user_id: string | null;
  assignee_user?: { id: string; full_name: string | null } | null;
  assignee_specialist?: { id: string; name: string } | null;
  financial_request?: {
    id: string;
    code: string;
    title: string;
    service_id?: string;
    service?: { id: string; name: string } | null;
  } | null;
}

interface MilestoneRowProps {
  milestone: OperationalRequest;
  specialists: { id: string; name: string }[];
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onUpdateField: (field: string, value: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function MilestoneRow({
  milestone,
  specialists,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onUpdateField,
  onEdit,
  onDelete,
}: MilestoneRowProps) {
  const queryClient = useQueryClient();
  const updateNotesMutation = useUpdateRequestNotes();
  const { tasks } = useRequestTasks(milestone.id);
  const [localNotes, setLocalNotes] = useState(milestone.notes || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(milestone.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Sync local notes when milestone notes change
  useEffect(() => {
    setLocalNotes(milestone.notes || '');
  }, [milestone.notes]);

  // Sync local name when milestone name changes
  useEffect(() => {
    setLocalName(milestone.name);
  }, [milestone.name]);

  // Debounced auto-save for notes
  const handleNotesChange = (value: string) => {
    setLocalNotes(value);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (value !== (milestone.notes || '')) {
        updateNotesMutation.mutate({ requestId: milestone.id, notes: value });
      }
    }, 800);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSave = () => {
    const trimmedName = localName.trim();
    if (trimmedName && trimmedName !== milestone.name) {
      onUpdateField('name', trimmedName);
    } else {
      setLocalName(milestone.name); // Reset if empty or unchanged
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNameSave();
    } else if (e.key === 'Escape') {
      setLocalName(milestone.name);
      setIsEditingName(false);
    }
  };

  const status = milestone.status as keyof typeof statusColors;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <Card className={cn(
      'transition-all',
      isSelected && 'ring-2 ring-primary/50',
      isExpanded && 'shadow-md',
      status === 'completed' && 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
    )}>
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        {/* Row Header */}
        <div className="flex items-center gap-2 p-3 sm:p-4">
          {/* Checkbox */}
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />

          {/* Expand Toggle */}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          {/* Milestone Info */}
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {status === 'completed' && (
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 shrink-0" />
                )}
                {isEditingName ? (
                  <Input
                    ref={nameInputRef}
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    onBlur={handleNameSave}
                    onKeyDown={handleNameKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 text-sm font-medium max-w-[300px]"
                  />
                ) : (
                  <span 
                    className={cn(
                      "font-medium truncate cursor-pointer hover:text-primary transition-colors",
                      status === 'completed' && "text-muted-foreground"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingName(true);
                    }}
                    title="Clic para editar nombre"
                  >
                    {milestone.name}
                  </span>
                )}
                {milestone.financial_request?.service?.name && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {milestone.financial_request.service.name}
                  </Badge>
                )}
                {milestone.notes && (
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </div>
              
              {/* Task Progress - visible on mobile below title */}
              {totalTasks > 0 && (
                <div className="flex items-center gap-2 mt-1 sm:hidden">
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {completedTasks}/{totalTasks} tareas
                  </span>
                </div>
              )}
            </div>

            {/* Inline Controls - Desktop */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <Select
                value={milestone.assignee_specialist_id || 'none'}
                onValueChange={async (value) => {
                  const newSpecialistId = value === 'none' ? null : value;
                  onUpdateField('assignee_specialist_id', newSpecialistId);
                  
                  // Sincronizar con financial_request vinculado
                  if (milestone.financial_request?.id) {
                    await supabase
                      .from('financial_requests')
                      .update({ specialist_id: newSpecialistId })
                      .eq('id', milestone.financial_request.id);
                    
                    // Invalidar queries de financial_requests
                    queryClient.invalidateQueries({ queryKey: ['financial-requests'] });
                    queryClient.invalidateQueries({ queryKey: ['budget-detail'] });
                  }
                }}
              >
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {specialists.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={milestone.deadline || ''}
                onChange={(e) => onUpdateField('deadline', e.target.value || null)}
                className="w-[130px] h-8 text-sm"
                onClick={(e) => e.stopPropagation()}
              />

              <Select
                value={milestone.status || 'pending'}
                onValueChange={(value) => onUpdateField('status', value)}
              >
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="in_review">En Revisión</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Task Progress - Desktop */}
          {totalTasks > 0 && (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {completedTasks}/{totalTasks}
              </span>
            </div>
          )}

          {/* Status Badge - Always visible */}
          <Badge className={cn(statusColors[status], 'shrink-0 sm:hidden')}>
            {statusLabels[status]}
          </Badge>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Inline Controls */}
        <div className="flex sm:hidden items-center gap-2 px-3 pb-3 -mt-1">
          <Select
            value={milestone.assignee_specialist_id || 'none'}
            onValueChange={async (value) => {
              const newSpecialistId = value === 'none' ? null : value;
              onUpdateField('assignee_specialist_id', newSpecialistId);
              
              // Sincronizar con financial_request vinculado
              if (milestone.financial_request?.id) {
                await supabase
                  .from('financial_requests')
                  .update({ specialist_id: newSpecialistId })
                  .eq('id', milestone.financial_request.id);
                
                // Invalidar queries de financial_requests
                queryClient.invalidateQueries({ queryKey: ['financial-requests'] });
                queryClient.invalidateQueries({ queryKey: ['budget-detail'] });
              }
            }}
          >
            <SelectTrigger className="flex-1 h-8 text-xs">
              <SelectValue placeholder="Especialista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar</SelectItem>
              {specialists.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={milestone.deadline || ''}
            onChange={(e) => onUpdateField('deadline', e.target.value || null)}
            className="w-[110px] h-8 text-xs"
          />

          <Select
            value={milestone.status || 'pending'}
            onValueChange={(value) => onUpdateField('status', value)}
          >
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in_progress">En Progreso</SelectItem>
              <SelectItem value="in_review">En Revisión</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Expanded Content */}
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4">
            <div className="border-t pt-4" />

            {/* Context URL */}
            {milestone.context_url && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open(milestone.context_url!, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Ver contexto
              </Button>
            )}

            {/* Notes */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Notas del milestone
              </label>
              <Textarea
                value={localNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Añadir notas sobre el estado, bloqueos, detalles importantes..."
                className="min-h-[80px] resize-none"
                rows={3}
              />
              {updateNotesMutation.isPending && (
                <span className="text-xs text-muted-foreground mt-1">Guardando...</span>
              )}
            </div>

            {/* Tasks List */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Tareas
              </label>
              <InlineTasksList
                requestId={milestone.id}
                defaultSpecialistId={milestone.assignee_specialist_id}
                defaultDeadline={milestone.deadline}
                specialists={specialists}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
