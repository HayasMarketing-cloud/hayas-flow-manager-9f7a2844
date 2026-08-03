import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Copy, FileText, Trash2, Check, X, Hash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useNavigate } from 'react-router-dom';
import { BudgetStatusBadge } from './BudgetStatusBadge';
import { formatCurrency, getBudgetStatusLabel } from '@/lib/budget-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { BudgetInvoicedBadge } from './BudgetInvoicedBadge';
import type { BudgetInvoicedSummary } from '@/hooks/useBudgetsInvoicedSummary';

interface BudgetCardProps {
  budget: any;
  onView: (budget: any) => void;
  onEdit?: (budget: any) => void;
  onDuplicate?: (budget: any) => void;
  onConvertToContract?: (budget: any) => void;
  onDelete?: (budget: any) => void;
  onRefresh?: () => void;
  invoicedSummary?: BudgetInvoicedSummary;
}


const BUDGET_STATUSES = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'sent', label: 'Enviado' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'rejected', label: 'Rechazado' },
];

export const BudgetCard = ({ budget, onView, onEdit, onDuplicate, onConvertToContract, onDelete, onRefresh, invoicedSummary }: BudgetCardProps) => {
  const navigate = useNavigate();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(budget.notes || '');
  const [editingPo, setEditingPo] = useState(false);
  const [poValue, setPoValue] = useState(budget.client_po_number || '');
  const [dateOpen, setDateOpen] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const poRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNotesValue(budget.notes || '');
  }, [budget.notes]);

  useEffect(() => {
    setPoValue(budget.client_po_number || '');
  }, [budget.client_po_number]);

  useEffect(() => {
    if (editingNotes && notesRef.current) {
      notesRef.current.focus();
    }
  }, [editingNotes]);

  useEffect(() => {
    if (editingPo && poRef.current) {
      poRef.current.focus();
      poRef.current.select();
    }
  }, [editingPo]);

  const handleUpdateField = async (field: string, value: any) => {
    const { error } = await supabase
      .from('budgets')
      .update({ [field]: value })
      .eq('id', budget.id);

    if (error) {
      toast.error('Error al actualizar');
      return;
    }
    toast.success('Actualizado');
    onRefresh?.();
  };

  const handleSaveNotes = async () => {
    setEditingNotes(false);
    if (notesValue !== (budget.notes || '')) {
      await handleUpdateField('notes', notesValue || null);
    }
  };

  const handleSavePo = async () => {
    setEditingPo(false);
    const trimmed = poValue.trim();
    if (trimmed !== (budget.client_po_number || '')) {
      await handleUpdateField('client_po_number', trimmed || null);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            {budget.code && (
              <span className="text-xs font-mono text-muted-foreground">{budget.code}</span>
            )}
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{budget.title}</h3>
              {budget.accepted_document_url && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <FileText className="h-4 w-4 text-green-600" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Documento aceptado enlazado</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {budget.client?.name || 'Sin cliente'}
              {budget.client_contact?.name && (
                <span className="text-xs ml-1">· {budget.client_contact.name}</span>
              )}
            </p>
            {budget.creator && (
              <p className="text-xs text-muted-foreground">
                Creado por: {budget.creator.full_name || budget.creator.email}
              </p>
            )}
          </div>
          {/* Inline status selector */}
          <Select
            value={toManualBudgetStatus(budget.status)}
            onValueChange={(value) => handleUpdateField('status', value)}
          >
            <SelectTrigger className="w-auto h-auto border-0 p-0 shadow-none focus:ring-0">
              <BudgetStatusBadge status={budget.status} invoicedSummary={invoicedSummary} />
            </SelectTrigger>
            <SelectContent>
              {BUDGET_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Monto Total</p>
            <p className="font-semibold text-lg">
              {formatCurrency(budget.total_amount || 0)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Fecha Facturación</p>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-normal h-8 text-xs",
                    !budget.estimated_invoice_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {budget.estimated_invoice_date
                    ? format(new Date(budget.estimated_invoice_date), 'dd MMM yyyy', { locale: es })
                    : 'Sin fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={budget.estimated_invoice_date ? new Date(budget.estimated_invoice_date) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      handleUpdateField('estimated_invoice_date', format(date, 'yyyy-MM-dd'));
                    }
                    setDateOpen(false);
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Estado de facturación */}
        <div className="border-t pt-2 mt-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Facturado</p>
          <BudgetInvoicedBadge summary={invoicedSummary} showProgress />
        </div>



        {/* Inline PO / Referencia Cliente */}
        <div className="border-t pt-2 mt-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">PO / Ref. Cliente</p>
          {editingPo ? (
            <Input
              ref={poRef}
              value={poValue}
              onChange={(e) => setPoValue(e.target.value)}
              onBlur={handleSavePo}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setPoValue(budget.client_po_number || '');
                  setEditingPo(false);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSavePo();
                }
              }}
              placeholder="Ej: PO-12345"
              className="h-8 text-xs"
            />
          ) : (
            <div
              onClick={() => setEditingPo(true)}
              className="cursor-pointer text-xs hover:bg-muted/50 rounded px-1 py-1 min-h-[28px] flex items-center gap-1.5 transition-colors"
            >
              {budget.client_po_number ? (
                <>
                  <Hash className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="font-mono">{budget.client_po_number}</span>
                </>
              ) : (
                <span className="italic text-muted-foreground">+ Añadir PO / Referencia...</span>
              )}
            </div>
          )}
        </div>

        {/* Inline Notes */}
        <div className="border-t pt-2 mt-2">
          {editingNotes ? (
            <div className="space-y-1">
              <textarea
                ref={notesRef}
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                onBlur={handleSaveNotes}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setNotesValue(budget.notes || '');
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
              {budget.notes ? (
                <p className="line-clamp-2">{budget.notes}</p>
              ) : (
                <p className="italic">+ Añadir nota...</p>
              )}
            </div>
          )}
        </div>

        {budget.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {budget.description}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate(`/presupuestos/${budget.id}`)} className="flex-1">
          <Eye className="h-4 w-4 mr-2" />
          Ver Detalle
        </Button>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={() => onEdit(budget)}>
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {onDuplicate && (
          <Button variant="outline" size="sm" onClick={() => onDuplicate(budget)}>
            <Copy className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button variant="outline" size="sm" onClick={() => onDelete(budget)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
