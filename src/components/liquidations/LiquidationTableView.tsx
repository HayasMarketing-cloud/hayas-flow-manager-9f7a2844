import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, Pencil } from 'lucide-react';
import { LiquidationStatusBadge } from './LiquidationStatusBadge';
import { formatPeriod, formatCurrency } from '@/lib/liquidation-utils';
import { Card, CardContent } from '@/components/ui/card';

interface LiquidationTableViewProps {
  liquidations: any[];
  onView: (liquidation: any) => void;
  onEdit: (liquidation: any) => void;
  canManage: boolean;
}

export const LiquidationTableView = ({ liquidations, onView, onEdit, canManage }: LiquidationTableViewProps) => {
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
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liquidations.map((liquidation) => {
                const isEditable = liquidation.status === 'draft';
                
                return (
                  <TableRow key={liquidation.id}>
                    <TableCell className="font-medium">{liquidation.code}</TableCell>
                    <TableCell>{liquidation.specialist?.name || 'N/A'}</TableCell>
                    <TableCell>{formatPeriod(liquidation.period_year, liquidation.period_month, 'short')}</TableCell>
                    <TableCell className="text-right">{formatCurrency(liquidation.subtotal)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(liquidation.tax_amount)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(liquidation.total_amount)}</TableCell>
                    <TableCell>
                      <LiquidationStatusBadge status={liquidation.status} />
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
