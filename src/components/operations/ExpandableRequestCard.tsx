import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Calendar, User, ExternalLink, MessageSquare } from 'lucide-react';
import { InlineTasksList } from './InlineTasksList';
import { useUpdateRequestNotes, useRequestTasks } from '@/hooks/useRequestTasks';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
    service?: { id: string; name: string } | null;
  } | null;
}

interface ExpandableRequestCardProps {
  request: OperationalRequest;
  specialists: { id: string; name: string }[];
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function ExpandableRequestCard({
  request,
  specialists,
  isExpanded,
  onToggleExpand,
}: ExpandableRequestCardProps) {
  const updateNotesMutation = useUpdateRequestNotes();
  const { tasks } = useRequestTasks(request.id);
  const [localNotes, setLocalNotes] = useState(request.notes || '');
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Sync local notes when request notes change
  useEffect(() => {
    setLocalNotes(request.notes || '');
  }, [request.notes]);

  // Debounced auto-save for notes
  const handleNotesChange = (value: string) => {
    setLocalNotes(value);
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounce
    debounceRef.current = setTimeout(() => {
      if (value !== (request.notes || '')) {
        updateNotesMutation.mutate({ requestId: request.id, notes: value });
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

  const status = request.status as keyof typeof statusColors;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const assigneeName = request.assignee_specialist?.name || 
    request.assignee_user?.full_name || 
    'Sin asignar';

  return (
    <Card className={cn('transition-shadow', isExpanded && 'shadow-md')}>
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        {/* Collapsed Header */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/50 transition-colors">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium truncate">{request.name}</h3>
                {request.financial_request?.service?.name && (
                  <Badge variant="outline" className="text-xs">
                    {request.financial_request.service.name}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {assigneeName}
                </span>
                {request.deadline && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(request.deadline).toLocaleDateString('es-ES')}
                  </span>
                )}
                {request.notes && (
                  <MessageSquare className="h-3.5 w-3.5" />
                )}
              </div>
            </div>

            {/* Status & Progress */}
            <div className="flex items-center gap-3 shrink-0">
              {totalTasks > 0 && (
                <div className="flex items-center gap-2">
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
              <Badge className={statusColors[status]}>
                {statusLabels[status]}
              </Badge>
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Expanded Content */}
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4">
            {/* Divider */}
            <div className="border-t" />

            {/* Context URL */}
            {request.context_url && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open(request.context_url!, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Ver contexto
              </Button>
            )}

            {/* Notes (editable inline) */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Notas del milestone
              </label>
              <Textarea
                ref={notesRef}
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
                requestId={request.id}
                defaultSpecialistId={request.assignee_specialist_id}
                specialists={specialists}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
