import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, Calendar } from 'lucide-react';
import { LiquidationStatusBadge } from './LiquidationStatusBadge';
import { formatPeriod, formatCurrency } from '@/lib/liquidation-utils';

interface LiquidationCardProps {
  liquidation: any;
  onView: (liquidation: any) => void;
  onEdit?: (liquidation: any) => void;
  canManage: boolean;
}

export const LiquidationCard = ({ liquidation, onView, onEdit, canManage }: LiquidationCardProps) => {
  const isEditable = liquidation.status === 'draft';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{liquidation.specialist?.name || 'Sin especialista'}</CardTitle>
          <LiquidationStatusBadge status={liquidation.status} />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {formatPeriod(liquidation.period_year, liquidation.period_month)} · {liquidation.code}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        <div className="text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 inline mr-2" />
          Creada: {new Date(liquidation.created_at).toLocaleDateString('es-ES')}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">Total:</span>
          <span className="text-lg font-bold">{formatCurrency(liquidation.calculated_total ?? liquidation.total_amount)}</span>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => onView(liquidation)} variant="outline" className="flex-1">
            <Eye className="h-4 w-4 mr-2" />
            Ver
          </Button>
          {canManage && isEditable && onEdit && (
            <Button onClick={() => onEdit(liquidation)} className="flex-1">
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
