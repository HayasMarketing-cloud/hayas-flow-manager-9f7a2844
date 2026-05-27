import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Link2, Sparkles, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/invoice-utils';

interface InlineInvoiceAssociationProps {
  invoiceId: string;
  clientId: string;
  subtotal: number;
}

const TOLERANCE = 1; // euros

export const InlineInvoiceAssociation = ({
  invoiceId,
  clientId,
  subtotal,
}: InlineInvoiceAssociationProps) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'budget' | 'contract'>('budget');
  const queryClient = useQueryClient();

  const { data: budgets = [] } = useQuery({
    queryKey: ['inline-budgets-for-invoice', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('id, code, title, total_amount, status')
        .eq('client_id', clientId)
        .in('status', ['approved', 'invoiced'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clientId,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['inline-contracts-for-invoice', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, code, title, status')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clientId,
  });

  const suggestions = useMemo(() => {
    if (!subtotal) return [];
    return budgets.filter(
      (b) =>
        b.total_amount != null &&
        Math.abs(Number(b.total_amount) - subtotal) <= TOLERANCE,
    );
  }, [budgets, subtotal]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { budget_id?: string | null; contract_id?: string | null }) => {
      const { error } = await supabase
        .from('invoices')
        .update(payload)
        .eq('id', invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Factura asociada correctamente');
      setOpen(false);
    },
    onError: (e: any) => toast.error('Error al asociar: ' + e.message),
  });

  const assignBudget = (budgetId: string) =>
    updateMutation.mutate({ budget_id: budgetId, contract_id: null });
  const assignContract = (contractId: string) =>
    updateMutation.mutate({ contract_id: contractId, budget_id: null });

  const hasSuggestion = suggestions.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Sin asociar
          {hasSuggestion && <Sparkles className="h-3 w-3 text-primary ml-0.5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        {hasSuggestion && (
          <div className="border-b bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Sugerencia automática (importe coincide)
            </div>
            {suggestions.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-2 bg-background rounded-md p-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-semibold">{b.code}</div>
                  <div className="text-xs text-muted-foreground truncate">{b.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(Number(b.total_amount))}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-7"
                  onClick={() => assignBudget(b.id)}
                  disabled={updateMutation.isPending}
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Asociar
                </Button>
              </div>
            ))}
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="p-2">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="budget" className="text-xs">
              Presupuesto
            </TabsTrigger>
            <TabsTrigger value="contract" className="text-xs">
              Contrato
            </TabsTrigger>
          </TabsList>

          <TabsContent value="budget" className="mt-2">
            <Command>
              <CommandInput placeholder="Buscar presupuesto..." className="h-8" />
              <CommandList className="max-h-[220px]">
                <CommandEmpty>Sin presupuestos disponibles</CommandEmpty>
                <CommandGroup>
                  {budgets.map((b) => {
                    const matches =
                      b.total_amount != null &&
                      Math.abs(Number(b.total_amount) - subtotal) <= TOLERANCE;
                    return (
                      <CommandItem
                        key={b.id}
                        value={`${b.code} ${b.title}`}
                        onSelect={() => assignBudget(b.id)}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold">{b.code}</span>
                            {matches && (
                              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                match
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {b.title}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatCurrency(Number(b.total_amount || 0))}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </TabsContent>

          <TabsContent value="contract" className="mt-2">
            <Command>
              <CommandInput placeholder="Buscar contrato..." className="h-8" />
              <CommandList className="max-h-[220px]">
                <CommandEmpty>Sin contratos activos</CommandEmpty>
                <CommandGroup>
                  {contracts.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.code} ${c.title}`}
                      onSelect={() => assignContract(c.id)}
                    >
                      <Link2 className="h-3.5 w-3.5 mr-2 text-blue-600" />
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs font-semibold">{c.code}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.title}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};
