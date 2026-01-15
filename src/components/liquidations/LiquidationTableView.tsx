import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, Trash2, Mail } from 'lucide-react';
import { LiquidationStatusBadge } from './LiquidationStatusBadge';
import { SignatureStatusBadge } from './SignatureStatusBadge';
import { formatPeriod, formatCurrency } from '@/lib/liquidation-utils';
import { Card, CardContent } from '@/components/ui/card';

interface LiquidationTableViewProps {
  liquidations: any[];
  onView: (liquidation: any) => void;
  onEdit: (liquidation: any) => void;
  onDelete: (liquidation: any) => void;
  onSendEmail?: (liquidation: any) => void;
  canManage: boolean;
  isSending?: boolean;
  sendingLiquidationId?: string;
}

export const LiquidationTableView = ({ 
  liquidations, 
  onView, 
  onEdit, 
  onDelete, 
  onSendEmail,
  canManage,
  isSending,
  sendingLiquidationId
}: LiquidationTableViewProps) => {
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
                const isEditable = liquidation.status === 'draft' || liquidation.status === 'validated';
                const hasSpecialistEmail = !!liquidation.specialist?.email;
                const isCurrentlySending = isSending && sendingLiquidationId === liquidation.id;
                const latestSignature = liquidation.liquidation_signatures?.[0] || null;
                
                return (
                  <TableRow key={liquidation.id}>
                    <TableCell className="font-medium">{liquidation.code}</TableCell>
                    <TableCell>{liquidation.specialist?.name || 'N/A'}</TableCell>
                    <TableCell>{formatPeriod(liquidation.period_year, liquidation.period_month, 'short')}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(liquidation.calculated_total ?? liquidation.subtotal ?? liquidation.total_amount)}</TableCell>
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
