import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Check, AlertCircle, FileText, FileSignature, FolderKanban } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/invoice-utils';
import { RequestCheckboxList } from './RequestCheckboxList';
import { useAvailableRequestsForReconciliation, AvailableRequest } from '@/hooks/useAvailableRequestsForReconciliation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UnassignedInvoice } from '@/hooks/useUnassignedInvoices';

interface ReconciliationRowProps {
  invoice: UnassignedInvoice;
}

interface EntitySummary {
  budgets: Map<string, { code: string; title: string; count: number; total: number }>;
  contracts: Map<string, { code: string; title: string; count: number; total: number }>;
  projects: Map<string, { name: string; count: number; total: number }>;
}

export function ReconciliationRow({ invoice }: ReconciliationRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const clientId = invoice.client?.id;
  const { data: availableRequests, isLoading: requestsLoading } = useAvailableRequestsForReconciliation(clientId);

  // Calculate selected total
  const selectedTotal = useMemo(() => {
    if (!availableRequests) return 0;
    return availableRequests
      .filter(r => selectedRequestIds.includes(r.id))
      .reduce((sum, r) => sum + (r.sale_amount || 0), 0);
  }, [availableRequests, selectedRequestIds]);

  // Calculate summary of budgets, contracts and projects being invoiced
  const entitySummary = useMemo<EntitySummary>(() => {
    const summary: EntitySummary = {
      budgets: new Map(),
      contracts: new Map(),
      projects: new Map(),
    };

    if (!availableRequests) return summary;

    const selectedRequests = availableRequests.filter(r => selectedRequestIds.includes(r.id));

    for (const req of selectedRequests) {
      const amount = req.sale_amount || 0;

      // Budget summary
      if (req.budget) {
        const existing = summary.budgets.get(req.budget.id);
        if (existing) {
          existing.count++;
          existing.total += amount;
        } else {
          summary.budgets.set(req.budget.id, {
            code: req.budget.code,
            title: req.budget.title,
            count: 1,
            total: amount,
          });
        }
      }

      // Contract summary
      if (req.contract) {
        const existing = summary.contracts.get(req.contract.id);
        if (existing) {
          existing.count++;
          existing.total += amount;
        } else {
          summary.contracts.set(req.contract.id, {
            code: req.contract.code,
            title: req.contract.title,
            count: 1,
            total: amount,
          });
        }
      }

      // Project summary
      if (req.operational_request && req.operational_request.length > 0) {
        const opReq = req.operational_request[0];
        if (opReq.operational_project) {
          const projectId = opReq.operational_project.id;
          const existing = summary.projects.get(projectId);
          if (existing) {
            existing.count++;
            existing.total += amount;
          } else {
            summary.projects.set(projectId, {
              name: opReq.operational_project.name,
              count: 1,
              total: amount,
            });
          }
        }
      }
    }

    return summary;
  }, [availableRequests, selectedRequestIds]);

  // Calculate difference
  const difference = invoice.subtotal - selectedTotal;
  const differencePercent = invoice.subtotal > 0 ? Math.abs(difference / invoice.subtotal) * 100 : 0;
  const isMatchClose = differencePercent <= 5;

  // Suggest requests that match the invoice subtotal (±5%)
  const suggestedRequestIds = useMemo(() => {
    if (!availableRequests || availableRequests.length === 0) return [];
    
    // Try to find a combination that matches
    // Simple heuristic: sort by amount descending, greedily select until close
    const sorted = [...availableRequests].sort((a, b) => (b.sale_amount || 0) - (a.sale_amount || 0));
    const target = invoice.subtotal;
    const tolerance = target * 0.05;
    
    let currentSum = 0;
    const selected: string[] = [];
    
    for (const req of sorted) {
      const amount = req.sale_amount || 0;
      if (currentSum + amount <= target + tolerance) {
        selected.push(req.id);
        currentSum += amount;
        if (Math.abs(currentSum - target) <= tolerance) break;
      }
    }
    
    // Only suggest if we got close enough
    if (Math.abs(currentSum - target) <= tolerance && selected.length > 0) {
      return selected;
    }
    return [];
  }, [availableRequests, invoice.subtotal]);

  const handleSelectRequest = (requestId: string, checked: boolean) => {
    if (checked) {
      setSelectedRequestIds(prev => [...prev, requestId]);
    } else {
      setSelectedRequestIds(prev => prev.filter(id => id !== requestId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && availableRequests) {
      setSelectedRequestIds(availableRequests.map(r => r.id));
    } else {
      setSelectedRequestIds([]);
    }
  };

  const handleApplySuggestion = () => {
    setSelectedRequestIds(suggestedRequestIds);
  };

  // Check if all requests from a budget are now invoiced and update budget status
  const checkAndUpdateBudgetStatus = async (budgetIds: string[]) => {
    const uniqueBudgetIds = [...new Set(budgetIds.filter(Boolean))];
    
    for (const budgetId of uniqueBudgetIds) {
      // Get all requests for this budget
      const { data: budgetRequests } = await supabase
        .from('financial_requests')
        .select('id, billed_invoice_id')
        .eq('budget_id', budgetId);
      
      if (!budgetRequests || budgetRequests.length === 0) continue;
      
      // Check if all requests have an invoice
      const allInvoiced = budgetRequests.every(r => r.billed_invoice_id !== null);
      
      if (allInvoiced) {
        // Update budget status to invoiced (only if currently approved)
        const { error } = await supabase
          .from('budgets')
          .update({ status: 'invoiced' })
          .eq('id', budgetId)
          .eq('status', 'approved');
        
        if (!error) {
          // Get budget info for toast
          const { data: budget } = await supabase
            .from('budgets')
            .select('code, title')
            .eq('id', budgetId)
            .single();
          
          if (budget) {
            toast.success(`Presupuesto ${budget.code} marcado como Facturado automáticamente`);
          }
        }
      }
    }
  };

  const associateMutation = useMutation({
    mutationFn: async () => {
      if (selectedRequestIds.length === 0) {
        throw new Error('Selecciona al menos una solicitud');
      }

      // Get budget_ids from selected requests before updating
      const { data: requestsWithBudgets } = await supabase
        .from('financial_requests')
        .select('id, budget_id')
        .in('id', selectedRequestIds);

      const { error } = await supabase
        .from('financial_requests')
        .update({ billed_invoice_id: invoice.id })
        .in('id', selectedRequestIds);

      if (error) throw error;

      // Return budget_ids for status check
      return requestsWithBudgets?.map(r => r.budget_id).filter(Boolean) as string[] || [];
    },
    onSuccess: async (budgetIds) => {
      // Check and update budget statuses
      await checkAndUpdateBudgetStatus(budgetIds);
      
      queryClient.invalidateQueries({ queryKey: ['unassigned-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['available-requests-for-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success(`${selectedRequestIds.length} solicitudes asociadas a factura ${invoice.code}`);
      setSelectedRequestIds([]);
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast.error('Error al asociar: ' + error.message);
    },
  });

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="py-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{invoice.code}</span>
                    <Badge variant="outline">{invoice.client?.name || 'Sin cliente'}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(invoice.invoice_date), 'd MMM yyyy', { locale: es })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(invoice.subtotal)}</p>
                <p className="text-sm text-muted-foreground">Subtotal</p>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 border-t">
            {!clientId ? (
              <p className="text-muted-foreground py-4">Esta factura no tiene cliente asignado</p>
            ) : requestsLoading ? (
              <p className="text-muted-foreground py-4">Cargando solicitudes...</p>
            ) : !availableRequests || availableRequests.length === 0 ? (
              <div className="py-4 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No hay solicitudes completadas sin facturar para este cliente</p>
              </div>
            ) : (
              <div className="py-4 space-y-4">
                {/* Suggestion banner */}
                {suggestedRequestIds.length > 0 && selectedRequestIds.length === 0 && (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm">
                        Sugerencia: {suggestedRequestIds.length} solicitudes coinciden con el subtotal
                      </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleApplySuggestion}>
                      Aplicar sugerencia
                    </Button>
                  </div>
                )}

                <RequestCheckboxList
                  requests={availableRequests}
                  selectedIds={selectedRequestIds}
                  onSelect={handleSelectRequest}
                  onSelectAll={handleSelectAll}
                />

                {/* Entity summary - budgets, contracts and projects being invoiced */}
                {selectedRequestIds.length > 0 && (entitySummary.budgets.size > 0 || entitySummary.contracts.size > 0 || entitySummary.projects.size > 0) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-blue-900">Resumen de entidades a facturar:</p>
                    
                    {entitySummary.budgets.size > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1 text-sm text-blue-800">
                          <FileText className="h-4 w-4" />
                          <span className="font-medium">Presupuestos:</span>
                        </div>
                        {Array.from(entitySummary.budgets.values()).map((budget, idx) => (
                          <Badge key={idx} variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">
                            {budget.code} ({budget.count} sol. · {formatCurrency(budget.total)})
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {entitySummary.contracts.size > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1 text-sm text-blue-800">
                          <FileSignature className="h-4 w-4" />
                          <span className="font-medium">Contratos:</span>
                        </div>
                        {Array.from(entitySummary.contracts.values()).map((contract, idx) => (
                          <Badge key={idx} variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                            {contract.code} ({contract.count} sol. · {formatCurrency(contract.total)})
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {entitySummary.projects.size > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1 text-sm text-blue-800">
                          <FolderKanban className="h-4 w-4" />
                          <span className="font-medium">Proyectos:</span>
                        </div>
                        {Array.from(entitySummary.projects.values()).map((project, idx) => (
                          <Badge key={idx} variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                            {project.name} ({project.count} sol. · {formatCurrency(project.total)})
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Summary bar */}
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Suma seleccionada</p>
                      <p className="font-semibold">{formatCurrency(selectedTotal)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Diferencia</p>
                      <p className={`font-semibold ${isMatchClose ? 'text-green-600' : 'text-amber-600'}`}>
                        {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                        {differencePercent > 0 && (
                          <span className="text-xs ml-1">({differencePercent.toFixed(1)}%)</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => associateMutation.mutate()}
                    disabled={selectedRequestIds.length === 0 || associateMutation.isPending}
                  >
                    {associateMutation.isPending ? 'Asociando...' : 'Asociar solicitudes'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
