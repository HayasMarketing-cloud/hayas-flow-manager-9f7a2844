import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/invoice-utils';
import { BudgetAllocation, calculateAllocationSummary } from '@/hooks/useInvoiceBudgetAllocations';

interface AvailableBudget {
  id: string;
  code: string;
  title: string;
  total_amount: number;
  invoiced_amount: number;
  remaining_amount: number;
  is_fully_invoiced: boolean;
}

interface BudgetAllocationEditorProps {
  invoiceTotal: number;
  allocations: BudgetAllocation[];
  availableBudgets: AvailableBudget[];
  onAllocationsChange: (allocations: BudgetAllocation[]) => void;
  disabled?: boolean;
}

export function BudgetAllocationEditor({
  invoiceTotal,
  allocations,
  availableBudgets,
  onAllocationsChange,
  disabled = false,
}: BudgetAllocationEditorProps) {
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>('');
  const [allocationAmount, setAllocationAmount] = useState<string>('');

  const summary = calculateAllocationSummary(invoiceTotal, allocations);

  // Filter out already allocated budgets
  const unallocatedBudgets = availableBudgets.filter(
    b => !allocations.some(a => a.budget_id === b.id)
  );

  const handleAddAllocation = () => {
    if (!selectedBudgetId) return;
    
    const budget = availableBudgets.find(b => b.id === selectedBudgetId);
    if (!budget) return;

    const amount = parseFloat(allocationAmount) || budget.remaining_amount || invoiceTotal - summary.total_allocated;
    
    if (amount <= 0) return;

    const newAllocation: BudgetAllocation = {
      budget_id: budget.id,
      budget_code: budget.code,
      budget_title: budget.title,
      budget_total: budget.total_amount,
      allocated_amount: amount,
      budget_invoiced_amount: budget.invoiced_amount,
      budget_remaining: budget.remaining_amount,
    };

    onAllocationsChange([...allocations, newAllocation]);
    setSelectedBudgetId('');
    setAllocationAmount('');
  };

  const handleRemoveAllocation = (budgetId: string) => {
    onAllocationsChange(allocations.filter(a => a.budget_id !== budgetId));
  };

  const handleUpdateAmount = (budgetId: string, newAmount: number) => {
    onAllocationsChange(
      allocations.map(a => 
        a.budget_id === budgetId 
          ? { ...a, allocated_amount: newAmount }
          : a
      )
    );
  };

  const getStatusIcon = () => {
    if (summary.percentage === 0) return null;
    if (summary.percentage > 100) return <AlertTriangle className="h-4 w-4 text-red-600" />;
    if (summary.percentage >= 100) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  };

  const getStatusClass = () => {
    if (summary.percentage === 0) return 'text-muted-foreground';
    if (summary.percentage > 100) return 'text-red-600';
    if (summary.percentage >= 100) return 'text-green-600';
    return 'text-yellow-600';
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Asociar a Presupuestos</Label>
          <p className="text-sm text-muted-foreground">
            Importe de factura: {formatCurrency(invoiceTotal)}
          </p>
        </div>
        <div className={`flex items-center gap-2 ${getStatusClass()}`}>
          {getStatusIcon()}
          <span className="text-sm font-medium">
            {formatCurrency(summary.total_allocated)} / {formatCurrency(invoiceTotal)}
            <span className="ml-1">({Math.round(summary.percentage)}%)</span>
          </span>
        </div>
      </div>

      {/* Add new allocation */}
      {!disabled && unallocatedBudgets.length > 0 && (
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Presupuesto</Label>
            <Select value={selectedBudgetId} onValueChange={setSelectedBudgetId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar presupuesto..." />
              </SelectTrigger>
              <SelectContent>
                {unallocatedBudgets.map(budget => {
                  const isPartiallyInvoiced = budget.invoiced_amount > 0 && !budget.is_fully_invoiced;
                  const isFullyInvoiced = budget.is_fully_invoiced;
                  
                  return (
                    <SelectItem 
                      key={budget.id} 
                      value={budget.id}
                    >
                      <div className="flex flex-col gap-1 py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{budget.code}</span>
                          <span className="text-muted-foreground">-</span>
                          <span className="truncate max-w-[150px]">{budget.title}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span>Total: {formatCurrency(budget.total_amount)}</span>
                          {budget.invoiced_amount > 0 && (
                            <span className="text-muted-foreground">
                              | Fact: {formatCurrency(budget.invoiced_amount)}
                            </span>
                          )}
                          <Badge 
                            variant={isFullyInvoiced ? "destructive" : isPartiallyInvoiced ? "secondary" : "outline"} 
                            className="text-xs"
                          >
                            Disp: {formatCurrency(budget.remaining_amount)}
                          </Badge>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32 space-y-1">
            <Label className="text-xs">Importe</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder={
                selectedBudgetId 
                  ? `Max: ${availableBudgets.find(b => b.id === selectedBudgetId)?.remaining_amount?.toFixed(2)}`
                  : '0.00'
              }
              value={allocationAmount}
              onChange={(e) => setAllocationAmount(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAddAllocation}
            disabled={!selectedBudgetId}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Allocations table */}
      {allocations.length > 0 && (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Presupuesto</TableHead>
                <TableHead className="text-right">Total Presup.</TableHead>
                <TableHead className="text-right">Ya Facturado</TableHead>
                <TableHead className="text-right w-32">Asignado</TableHead>
                {!disabled && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.map(allocation => (
                <TableRow key={allocation.budget_id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{allocation.budget_code}</span>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {allocation.budget_title}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(allocation.budget_total)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(allocation.budget_invoiced_amount - allocation.allocated_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {disabled ? (
                      <span className="font-medium">{formatCurrency(allocation.allocated_amount)}</span>
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-24 text-right h-8"
                        value={allocation.allocated_amount}
                        onChange={(e) => handleUpdateAmount(allocation.budget_id, parseFloat(e.target.value) || 0)}
                      />
                    )}
                  </TableCell>
                  {!disabled && (
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveAllocation(allocation.budget_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary */}
      {allocations.length > 0 && (
        <div className={`flex items-center justify-end gap-2 pt-2 border-t ${getStatusClass()}`}>
          {getStatusIcon()}
          <span className="text-sm">
            Total asignado: <span className="font-semibold">{formatCurrency(summary.total_allocated)}</span>
            {' / '}
            {formatCurrency(invoiceTotal)}
            {summary.invoice_remaining !== 0 && (
              <span className="ml-2">
                ({summary.invoice_remaining > 0 ? 'Falta' : 'Exceso'}: {formatCurrency(Math.abs(summary.invoice_remaining))})
              </span>
            )}
          </span>
        </div>
      )}

      {allocations.length === 0 && !disabled && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No hay presupuestos asignados. Añade uno para conciliar esta factura.
        </p>
      )}
    </Card>
  );
}
