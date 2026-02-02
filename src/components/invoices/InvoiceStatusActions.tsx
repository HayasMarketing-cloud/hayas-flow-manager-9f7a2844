import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChevronDown, Send, Check, AlertTriangle, X, Loader2, Undo2 } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

interface InvoiceStatusActionsProps {
  invoiceId: string;
  currentStatus: InvoiceStatus;
  compact?: boolean;
}

const statusTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled'],
  paid: ['sent'],  // Allow reverting to pending
  overdue: ['paid', 'cancelled'],
  cancelled: [],
};

// Get label for transition - special case for reverting paid invoices
const getTransitionLabel = (from: InvoiceStatus, to: InvoiceStatus, defaultLabels: Record<InvoiceStatus, string>): string => {
  if (from === 'paid' && to === 'sent') {
    return 'Revertir a Pendiente';
  }
  return defaultLabels[to];
};

// Get icon for transition - special case for reverting
const getTransitionIcon = (from: InvoiceStatus, to: InvoiceStatus, defaultIcons: Record<InvoiceStatus, React.ReactNode>): React.ReactNode => {
  if (from === 'paid' && to === 'sent') {
    return <Undo2 className="h-4 w-4" />;
  }
  return defaultIcons[to];
};

// === FACTURAS EMITIDAS A CLIENTES ===
// Para facturas emitidas usamos terminología de "cobro" (ingresos)
const statusLabels: Record<InvoiceStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  paid: 'Cobrada',  // Changed from 'Pagada' - cliente invoices are "collected"
  overdue: 'Vencida',
  cancelled: 'Cancelada',
};

const statusIcons: Record<InvoiceStatus, React.ReactNode> = {
  draft: null,
  sent: <Send className="h-4 w-4" />,
  paid: <Check className="h-4 w-4" />,
  overdue: <AlertTriangle className="h-4 w-4" />,
  cancelled: <X className="h-4 w-4" />,
};

export function InvoiceStatusActions({ invoiceId, currentStatus, compact = false }: InvoiceStatusActionsProps) {
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const availableTransitions = statusTransitions[currentStatus] || [];

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: InvoiceStatus) => {
      setIsUpdating(true);
      const updates: Record<string, any> = { status: newStatus };
      
      if (newStatus === 'sent' && currentStatus === 'draft') {
        updates.sent_at = new Date().toISOString();
      } else if (newStatus === 'paid') {
        updates.paid_at = new Date().toISOString();
      } else if (newStatus === 'sent' && currentStatus === 'paid') {
        // REVERTING: clear paid_at and remove payment links
        updates.paid_at = null;
        
        // Delete invoice_payments records for this invoice
        const { error: deleteError } = await supabase
          .from('invoice_payments')
          .delete()
          .eq('invoice_id', invoiceId);
        
        if (deleteError) {
          console.error('Error deleting invoice_payments:', deleteError);
          // Continue anyway - the payment link might not exist
        }
      }

      const { error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId);

      if (error) throw error;
      
      return newStatus;
    },
    onSuccess: (newStatus) => {
      const message = currentStatus === 'paid' && newStatus === 'sent'
        ? 'Factura revertida a Pendiente de cobro'
        : `Factura marcada como ${statusLabels[newStatus]}`;
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (error) => {
      console.error('Error updating invoice status:', error);
      toast.error('Error al actualizar el estado');
    },
    onSettled: () => {
      setIsUpdating(false);
    },
  });

  if (availableTransitions.length === 0) {
    return null;
  }

  // If only one transition and it's to "paid", show prominent button
  if (currentStatus === 'sent' && !compact) {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={() => updateStatusMutation.mutate('paid')}
          disabled={isUpdating}
          className="bg-green-600 hover:bg-green-700"
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Marcar Cobrada
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isUpdating}>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {availableTransitions
              .filter((s) => s !== 'paid')
              .map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => updateStatusMutation.mutate(status)}
                >
                  {statusIcons[status]}
                  <span className="ml-2">{statusLabels[status]}</span>
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isUpdating}>
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Cambiar estado
              <ChevronDown className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availableTransitions.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => updateStatusMutation.mutate(status)}
          >
            {getTransitionIcon(currentStatus, status, statusIcons)}
            <span className="ml-2">{getTransitionLabel(currentStatus, status, statusLabels)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
