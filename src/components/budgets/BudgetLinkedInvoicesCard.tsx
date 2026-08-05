import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { BudgetAllocationStatus } from '@/components/invoices/AllocationStatusBadge';
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge';
import { useBudgetMilestoneBreakdown } from '@/hooks/useBudgetMilestoneResolver';
import { formatCurrency } from '@/lib/budget-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Receipt, Calendar, FileText, ExternalLink, CircleDashed, Milestone, PlusCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface BudgetLinkedInvoicesCardProps {
  budgetId: string;
  /** Always pass budgets.total_amount — the single source of truth. */
  budgetTotal: number;
  estimatedInvoiceDate?: string | null;
}

export function BudgetLinkedInvoicesCard({
  budgetId,
  budgetTotal,
  estimatedInvoiceDate,
}: BudgetLinkedInvoicesCardProps) {
  const { data: breakdown, isLoading } = useBudgetMilestoneBreakdown(budgetId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Facturación por hitos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!breakdown) return null;

  const { plan, isSynthetic, milestones, additional, totalInvoiced, percentCovered } = breakdown;
  const remaining = Math.max(0, budgetTotal - totalInvoiced);
  const invoicesCount =
    milestones.filter((m) => m.match).length + additional.length;

  const openInvoice = (code: string) => {
    // Deep-link to the invoices list filtered by this invoice code
    window.open(`/facturas?search=${encodeURIComponent(code)}`, '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Facturación por hitos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Header row: estimated date + status badge */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Fecha estimada:</span>
            {estimatedInvoiceDate ? (
              <span className="font-medium">
                {format(new Date(estimatedInvoiceDate), 'dd/MM/yyyy', { locale: es })}
              </span>
            ) : (
              <span className="text-muted-foreground italic">No especificada</span>
            )}
          </div>
          <BudgetAllocationStatus
            invoicedAmount={totalInvoiced}
            budgetTotal={budgetTotal}
          />
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Facturado {formatCurrency(totalInvoiced)} de {formatCurrency(budgetTotal)}
            </span>
            <span>{percentCovered.toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(100, percentCovered)} className="h-2" />
          {remaining > 0.01 && (
            <p className="text-xs text-muted-foreground">
              Pendiente por facturar: <span className="font-medium">{formatCurrency(remaining)}</span>
            </p>
          )}
        </div>

        {/* Milestone breakdown */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hito</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Importe hito</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.map(({ index, milestone, match }) => {
                const base = getMilestoneBase(milestone as any, budgetTotal);
                const milestoneAmount = getMilestoneAmount(milestone as any, budgetTotal);
                return (
                  <TableRow key={`m-${index}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Milestone className="h-4 w-4 text-primary" />
                        <div>
                          <div className="text-sm font-medium">{milestone.label}</div>
                          {(milestone as any).po_number && (
                            <div className="text-xs text-muted-foreground">
                              PO: {(milestone as any).po_number}
                            </div>
                          )}
                          {milestone.invoice_date && (
                            <div className="text-xs text-muted-foreground">
                              Prev.: {format(new Date(milestone.invoice_date), 'dd/MM/yyyy', { locale: es })}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {Math.round(Number(milestone.percentage) || 0)}%
                      <div className="text-[10px] font-normal text-muted-foreground">
                        s/ {formatCurrency(base)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(milestoneAmount)}
                    </TableCell>

                    <TableCell>
                      {match ? (
                        <div className="flex items-center gap-2">
                          <button
                            className="text-sm font-medium text-primary hover:underline"
                            onClick={() => openInvoice(match.invoiceCode)}
                          >
                            {match.invoiceCode}
                          </button>
                          {match.matchType === 'fallback' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-[10px] py-0 border-blue-200 bg-blue-50 text-blue-800">
                                    auto
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Vinculación deducida por importe y fecha
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(match.allocatedAmount)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <CircleDashed className="h-3 w-3" />
                          Pendiente
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {match ? <InvoiceStatusBadge status={match.invoiceStatus as any} /> : '—'}
                    </TableCell>
                    <TableCell>
                      {match && (
                        <div className="flex gap-1">
                          {match.pdfUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => window.open(match.pdfUrl!, '_blank')}
                              title="Ver PDF"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openInvoice(match.invoiceCode)}
                            title="Abrir factura"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {additional.map((extra) => (
                <TableRow key={`extra-${extra.invoiceId}`} className="bg-amber-50/40">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PlusCircle className="h-4 w-4 text-amber-600" />
                      <div className="text-sm font-medium text-amber-900">Factura adicional</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        className="text-sm font-medium text-primary hover:underline"
                        onClick={() => openInvoice(extra.invoiceCode)}
                      >
                        {extra.invoiceCode}
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(extra.allocatedAmount)} ({extra.allocationPercentage.toFixed(1)}%)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={extra.invoiceStatus as any} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {extra.pdfUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => window.open(extra.pdfUrl!, '_blank')}
                          title="Ver PDF"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openInvoice(extra.invoiceCode)}
                        title="Abrir factura"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap justify-between items-center gap-2 pt-1 text-xs text-muted-foreground">
          <span>
            {isSynthetic
              ? 'Sin plan de pagos definido — se asume facturación única al 100%.'
              : `Plan de ${plan.length} hito${plan.length !== 1 ? 's' : ''}.`}
          </span>
          <span>
            {invoicesCount} factura{invoicesCount !== 1 ? 's' : ''} vinculada{invoicesCount !== 1 ? 's' : ''} · Total facturado: {formatCurrency(totalInvoiced)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
