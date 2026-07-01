import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RequestStatusBadge } from './RequestStatusBadge';
import { RequestFlowIndicator } from './RequestFlowIndicator';
import { RequestFlowActions } from './RequestFlowActions';
import { SlackDMButton } from './SlackDMButton';
import { FlowStatusCell } from './FlowStatusCell';
import { OriginCell } from './OriginCell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useQuery } from '@tanstack/react-query';
import { Edit, Building2, Calendar as CalendarIcon, Copy, Trash2, Eye, Receipt, User, Clock, Euro } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getFinancialRequestStatusLabel, formatCurrency } from '@/lib/request-utils';
import { Database } from '@/integrations/supabase/types';

type FinancialRequestStatus = Database['public']['Enums']['financial_request_status'];

const REQUEST_STATUSES: { value: FinancialRequestStatus; label: string }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'pending_specialist', label: 'Pend. Especialista' },
  { value: 'pending_approval', label: 'Pend. Aprobación' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'pending_review', label: 'Pend. Revisión' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
];

interface RequestCardProps {
  request: any;
  onEdit: (request: any) => void;
  onDelete: (request: any) => void;
  onClone: (request: any) => void;
  onAddToLiquidation?: (request: any) => void;
  canManage: boolean;
  onRefresh?: () => void;
}

export const RequestCard = ({ request, onEdit, onDelete, onClone, onAddToLiquidation, canManage, onRefresh }: RequestCardProps) => {
  const navigate = useNavigate();
  const isLiquidated = !!request.liquidation_id;
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(request.notes || '');
  const [dateOpen, setDateOpen] = useState(false);
  const [specialistOpen, setSpecialistOpen] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const canEditSpecialist = canManage && !isLiquidated;

  const { data: activeSpecialists = [] } = useQuery({
    queryKey: ['active-specialists-lite'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: canEditSpecialist,
  });

  useEffect(() => {
    setNotesValue(request.notes || '');
  }, [request.notes]);

  useEffect(() => {
    if (editingNotes && notesRef.current) {
      notesRef.current.focus();
    }
  }, [editingNotes]);

  const handleUpdateField = async (field: string, value: any) => {
    const { error } = await supabase
      .from('financial_requests')
      .update({ [field]: value } as any)
      .eq('id', request.id);

    if (error) {
      toast.error('Error al actualizar');
      return;
    }
    toast.success('Actualizado');
    onRefresh?.();
  };

  const handleSaveNotes = async () => {
    setEditingNotes(false);
    if (notesValue !== (request.notes || '')) {
      await handleUpdateField('notes', notesValue || null);
    }
  };

  return (
    <Card className={`hover:shadow-lg transition-shadow ${isLiquidated ? 'bg-muted/50 opacity-75' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-mono">{request.code}</p>
            <CardTitle className="text-lg mt-1">{request.title}</CardTitle>
            <div className="flex flex-wrap gap-1 mt-1">
              {(request as any).is_recurring_template && (
                <Badge variant="secondary" className="text-xs">Plantilla</Badge>
              )}
              {(request as any).is_recurring_template && (request as any).recurrence_active === false && (
                <Badge variant="outline" className="text-xs">Pausada</Badge>
              )}
              {(request as any).template_source_id && !(request as any).is_recurring_template && (
                <Badge variant="outline" className="text-xs">Generada automáticamente</Badge>
              )}
            </div>
          </div>
          {/* Inline status selector */}
          {canManage && !isLiquidated ? (
            <Select
              value={request.status}
              onValueChange={(value) => handleUpdateField('status', value)}
            >
              <SelectTrigger className="w-auto h-auto border-0 p-0 shadow-none focus:ring-0">
                <RequestStatusBadge status={request.status} isLiquidated={isLiquidated} />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <RequestStatusBadge status={request.status} isLiquidated={isLiquidated} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Flow Indicator */}
        <div className="py-2 border-y">
          <RequestFlowIndicator status={request.status} />
        </div>

        {request.client && (
          <div className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-3 py-1.5 max-w-full">
            <Building2 className="h-4 w-4 flex-shrink-0" />
            <span className="font-semibold text-sm truncate">{request.client.name}</span>
          </div>
        )}

        {/* Origin info */}
        <OriginCell
          budgetId={request.budget_id}
          budgetCode={request.budget?.code}
          contractId={request.contract_id}
          contractTitle={request.contract?.title}
          operationalProject={request.operational_request?.[0]?.operational_project}
        />
        
        {request.specialist && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{request.specialist.name}</span>
          </div>
        )}
        
        {(() => {
          const isHourly = request.cost_type === 'hourly' || (!!request.hours && !request.fixed_cost);
          const hourlyCost = (Number(request.hours) || 0) * (Number(request.cost_rate) || 0);
          const specialistCost = isHourly
            ? (Number(request.cost_to_agency) || hourlyCost)
            : Number(request.fixed_cost ?? request.cost_to_agency ?? 0);
          if (!request.hours && !specialistCost) return null;
          return (
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              {isHourly && request.hours ? (
                <span className="inline-flex items-center gap-1" title="Horas del especialista">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  {request.hours}h
                  {request.cost_rate ? (
                    <span className="text-xs"> × {formatCurrency(Number(request.cost_rate))}/h</span>
                  ) : null}
                </span>
              ) : null}
              {specialistCost ? (
                <span className="inline-flex items-center gap-1 font-semibold text-foreground" title="Coste especialista">
                  <Euro className="h-4 w-4 flex-shrink-0" />
                  {formatCurrency(specialistCost)}
                </span>
              ) : null}
            </div>
          );
        })()}

        {/* Inline editable deadline */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal h-7 text-xs px-2",
                  !request.deadline && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-3 w-3 mr-1" />
                {request.deadline
                  ? `Vence: ${format(new Date(request.deadline), 'dd MMM yyyy', { locale: es })}`
                  : 'Sin fecha límite'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={request.deadline ? new Date(request.deadline) : undefined}
                onSelect={(date) => {
                  if (date) {
                    handleUpdateField('deadline', format(date, 'yyyy-MM-dd'));
                  }
                  setDateOpen(false);
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Inline Notes */}
        <div className="border-t pt-2">
          {editingNotes ? (
            <div className="space-y-1">
              <textarea
                ref={notesRef}
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                onBlur={handleSaveNotes}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setNotesValue(request.notes || '');
                    setEditingNotes(false);
                  }
                }}
                placeholder="Escribe una nota..."
                className="w-full min-h-[48px] text-xs rounded-md border border-input bg-background px-2 py-1.5 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                rows={2}
              />
              <p className="text-[10px] text-muted-foreground">Esc cancelar · clic fuera para guardar</p>
            </div>
          ) : (
            <div
              onClick={() => setEditingNotes(true)}
              className="cursor-pointer text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded px-1 py-1 min-h-[28px] transition-colors"
            >
              {request.notes ? (
                <p className="line-clamp-2">{request.notes}</p>
              ) : (
                <p className="italic">+ Añadir nota...</p>
              )}
            </div>
          )}
        </div>

        {/* Invoice/Liquidation Status */}
        <div className="flex items-center gap-4 pt-2">
          <FlowStatusCell
            type="invoice"
            linkedId={request.billed_invoice_id}
            linkedCode={request.invoice?.code}
            linkedStatus={request.invoice?.status}
          />
          <FlowStatusCell
            type="liquidation"
            linkedId={request.liquidation_id}
            linkedCode={request.liquidation?.code}
            linkedStatus={request.liquidation?.status}
          />
        </div>

        {/* Flow Actions */}
        {canManage && (
          <div className="pt-3 border-t mt-3 flex items-center gap-2 flex-wrap">
            <RequestFlowActions request={request} onSuccess={onRefresh} compact />
            {request.specialist && request.status !== 'completed' && request.status !== 'cancelled' && (
              <SlackDMButton request={request} compact />
            )}
          </div>
        )}

        <div className="pt-2 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/solicitudes/${request.id}`)}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver Detalle
          </Button>
          {canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(request)}
                title="Editar"
              >
                <Edit className="h-4 w-4" />
              </Button>
              {!request.liquidation_id && onAddToLiquidation && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddToLiquidation(request)}
                  title="Añadir a Liquidación"
                >
                  <Receipt className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onClone(request)}
                title="Clonar"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(request)}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
