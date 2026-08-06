import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/budget-utils';
import {
  buildBudgetGenerationPlan,
  GenerationLine,
  summarizeBySpecialist,
} from '@/lib/budget-request-generation';

interface Props {
  budgetId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'approve' añade el cambio de estado del presupuesto tras generar */
  mode: 'generate' | 'approve';
  onConfirm: (args: { budget: any; lines: GenerationLine[] }) => Promise<void> | void;
  isSubmitting?: boolean;
}

export function GenerateRequestsConfirmModal({
  budgetId,
  open,
  onOpenChange,
  mode,
  onConfirm,
  isSubmitting,
}: Props) {
  const [lines, setLines] = useState<GenerationLine[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPhase, setBulkPhase] = useState('');
  const [bulkDeadline, setBulkDeadline] = useState('');

  const { data: plan, isLoading } = useQuery({
    queryKey: ['budget-generation-plan', budgetId, open],
    queryFn: () => buildBudgetGenerationPlan(budgetId!),
    enabled: !!budgetId && open,
  });

  useEffect(() => {
    if (plan) {
      setLines(plan.lines);
      setSelected(new Set());
      setBulkPhase('');
      setBulkDeadline('');
    }
  }, [plan]);

  const summary = useMemo(() => summarizeBySpecialist(lines), [lines]);
  const withoutSpecialist = lines.filter((l) => !l.specialistId);
  const withoutCost = lines.filter((l) => !l.costToAgency || !l.hours);

  const updateLine = (itemId: string, patch: Partial<GenerationLine>) => {
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, ...patch } : l)));
  };

  const toggle = (itemId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const applyBulk = () => {
    if (selected.size === 0) return;
    setLines((prev) =>
      prev.map((l) =>
        selected.has(l.itemId)
          ? {
              ...l,
              phase: bulkPhase ? bulkPhase : l.phase,
              deadline: bulkDeadline ? bulkDeadline : l.deadline,
            }
          : l
      )
    );
  };

  const blocked = (plan?.linesWithoutService.length || 0) > 0;
  const totalCost = summary.reduce((s, x) => s + x.cost, 0);
  const totalHours = summary.reduce((s, x) => s + x.hours, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'approve' ? 'Aprobar y generar solicitudes' : 'Generar requests'}
          </DialogTitle>
          <DialogDescription>
            Revisa el resumen por especialista antes de crear ningún dato. Nada se inserta hasta que
            confirmes.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="space-y-4">
            {plan && plan.alreadyGeneratedCount > 0 && (
              <Alert>
                <AlertDescription>
                  Este presupuesto ya tiene {plan.alreadyGeneratedCount} línea(s) con request
                  generada. Solo se muestran las {lines.length} línea(s) pendientes.
                </AlertDescription>
              </Alert>
            )}

            {blocked && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Hay líneas sin servicio asignado ({plan?.linesWithoutService.join(', ')}). Edita el
                  presupuesto antes de generar.
                </AlertDescription>
              </Alert>
            )}

            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay líneas pendientes de generar.
              </p>
            ) : (
              <>
                <div>
                  <h4 className="font-medium mb-2">Resumen por especialista</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Especialista</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                        <TableHead className="text-right">Horas</TableHead>
                        <TableHead className="text-right">Coste</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.map((s) => (
                        <TableRow key={s.specialistId || 'none'}>
                          <TableCell>
                            {s.specialistName}
                            {!s.specialistId && (
                              <Badge variant="outline" className="ml-2">
                                aviso
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{s.count}</TableCell>
                          <TableCell className="text-right">{s.hours}</TableCell>
                          <TableCell className="text-right">{formatCurrency(s.cost)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-medium">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{lines.length}</TableCell>
                        <TableCell className="text-right">{totalHours}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalCost)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {(withoutSpecialist.length > 0 || withoutCost.length > 0) && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="space-y-1">
                      {withoutSpecialist.length > 0 && (
                        <div>
                          {withoutSpecialist.length} línea(s) sin especialista asignado:{' '}
                          {withoutSpecialist.map((l) => l.description).join(', ')}
                        </div>
                      )}
                      {withoutCost.length > 0 && (
                        <div>
                          {withoutCost.length} línea(s) sin horas o sin coste:{' '}
                          {withoutCost.map((l) => l.description).join(', ')}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Fase (bloque)</Label>
                    <Input
                      value={bulkPhase}
                      onChange={(e) => setBulkPhase(e.target.value)}
                      placeholder="Ej. Fase 1"
                      className="h-8 w-40"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Deadline (bloque)</Label>
                    <Input
                      type="date"
                      value={bulkDeadline}
                      onChange={(e) => setBulkDeadline(e.target.value)}
                      className="h-8 w-44"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={applyBulk}
                    disabled={selected.size === 0}
                  >
                    Aplicar a {selected.size} seleccionada(s)
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Línea</TableHead>
                      <TableHead>Especialista</TableHead>
                      <TableHead className="w-36">Fase</TableHead>
                      <TableHead className="w-40">Deadline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => (
                      <TableRow key={l.itemId}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(l.itemId)}
                            onCheckedChange={() => toggle(l.itemId)}
                          />
                        </TableCell>
                        <TableCell className="text-sm">{l.description}</TableCell>
                        <TableCell className="text-sm">{l.specialistName}</TableCell>
                        <TableCell>
                          <Input
                            className="h-8"
                            value={l.phase || ''}
                            onChange={(e) => updateLine(l.itemId, { phase: e.target.value || null })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            className="h-8"
                            value={l.deadline || ''}
                            onChange={(e) =>
                              updateLine(l.itemId, { deadline: e.target.value || null })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => plan && onConfirm({ budget: plan.budget, lines })}
            disabled={blocked || isSubmitting || isLoading || (mode === 'generate' && lines.length === 0)}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === 'approve'
              ? `Aprobar y generar ${lines.length} request(s)`
              : `Generar ${lines.length} request(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
