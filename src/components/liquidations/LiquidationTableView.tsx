import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, Pencil, Trash2, Mail, Users, Info } from 'lucide-react';
import { LiquidationStatusBadge } from './LiquidationStatusBadge';
import { SignatureStatusBadge } from './SignatureStatusBadge';
import { formatPeriod, formatCurrency } from '@/lib/liquidation-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface LiquidationTableViewProps {
  liquidations: any[];
  onView: (liquidation: any) => void;
  onEdit: (liquidation: any) => void;
  onDelete: (liquidation: any) => void;
  onSendEmail?: (liquidation: any) => void;
  canManage: boolean;
  isSending?: boolean;
  sendingLiquidationId?: string;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

export const LiquidationTableView = ({ 
  liquidations, 
  onView, 
  onEdit, 
  onDelete, 
  onSendEmail,
  canManage,
  isSending,
  sendingLiquidationId,
  selectedIds = [],
  onSelectionChange
}: LiquidationTableViewProps) => {
  // Liquidations that can be marked as paid (pending_payment or accepted)
  const payableLiquidations = liquidations.filter(
    liq => liq.status !== 'draft' && liq.status !== 'paid'
  );
  
  const allPayableSelected = payableLiquidations.length > 0 && 
    payableLiquidations.every(liq => selectedIds.includes(liq.id));
  
  const somePayableSelected = payableLiquidations.some(liq => selectedIds.includes(liq.id));

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(payableLiquidations.map(liq => liq.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (liquidationId: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedIds, liquidationId]);
    } else {
      onSelectionChange(selectedIds.filter(id => id !== liquidationId));
    }
  };

  const isPayable = (status: string) => status !== 'draft' && status !== 'paid';

  if (!liquidations || liquidations.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">No hay liquidaciones para mostrar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && onSelectionChange && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allPayableSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Seleccionar todas las liquidaciones pagables"
                      className={somePayableSelected && !allPayableSelected ? "data-[state=checked]:bg-primary/50" : ""}
                    />
                  </TableHead>
                )}
                <TableHead>Código</TableHead>
                <TableHead>Especialista</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liquidations.map((liquidation) => {
                const isEditable = liquidation.status === 'draft' || liquidation.status === 'validated' || liquidation.status === 'sent';
                const hasSpecialistEmail = !!liquidation.specialist?.email;
                const isCurrentlySending = isSending && sendingLiquidationId === liquidation.id;
                const latestSignature = liquidation.liquidation_signatures?.[0] || null;
                const canBeSelected = isPayable(liquidation.status);
                const isSelected = selectedIds.includes(liquidation.id);
                
                // Team liquidation properties
                const isTeamLiquidation = liquidation.is_team === true;
                const displayTotal = isTeamLiquidation 
                  ? liquidation.team_total 
                  : (liquidation.calculated_total ?? liquidation.subtotal ?? liquidation.total_amount);
                
                return (
                  <TableRow key={liquidation.id} className={isSelected ? "bg-muted/50" : ""}>
                    {canManage && onSelectionChange && (
                      <TableCell>
                        {canBeSelected ? (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectOne(liquidation.id, checked as boolean)}
                            aria-label={`Seleccionar ${liquidation.code}`}
                          />
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{liquidation.code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {liquidation.specialist?.name || 'N/A'}
                        {isTeamLiquidation && (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            Equipo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatPeriod(liquidation.period_year, liquidation.period_month, 'short')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <div className="flex items-center justify-end gap-1">
                        {formatCurrency(displayTotal)}
                        {isTeamLiquidation && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">
                                  <div>Líder: {formatCurrency(liquidation.leader_total || 0)}</div>
                                  <div>Miembros: {formatCurrency((liquidation.team_total || 0) - (liquidation.leader_total || 0))}</div>
                                  {liquidation.team_members?.map((m: any) => (
                                    <div key={m.id} className="text-xs text-muted-foreground pl-2">
                                      • {m.name}: {formatCurrency(m.total || 0)}
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <LiquidationStatusBadge status={liquidation.status} />
                    </TableCell>
                    <TableCell>
                      <SignatureStatusBadge signature={latestSignature} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(liquidation)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canManage && isEditable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(liquidation)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canManage && isEditable && hasSpecialistEmail && onSendEmail && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSendEmail(liquidation)}
                            disabled={isCurrentlySending}
                            className="text-primary hover:text-primary"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        {canManage && isEditable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(liquidation)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
