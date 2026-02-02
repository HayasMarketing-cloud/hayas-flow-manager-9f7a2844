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
import { ChevronDown, Send, Check, AlertTriangle, X, Loader2 } from 'lucide-react';
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
  paid: [],
  overdue: ['paid', 'cancelled'],
  cancelled: [],
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
      }

      const { error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      toast.success(`Factura marcada como ${statusLabels[newStatus]}`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
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
            {statusIcons[status]}
            <span className="ml-2">{statusLabels[status]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
