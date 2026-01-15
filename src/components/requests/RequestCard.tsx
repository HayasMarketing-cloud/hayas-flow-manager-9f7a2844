import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RequestStatusBadge } from './RequestStatusBadge';
import { RequestFlowIndicator } from './RequestFlowIndicator';
import { RequestFlowActions } from './RequestFlowActions';
import { FlowStatusCell } from './FlowStatusCell';
import { Edit, Building2, Calendar, Euro, Copy, Trash2, Eye, Receipt } from 'lucide-react';
import { formatCurrency } from '@/lib/request-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface RequestCardProps {
  request: any;
  onEdit: (request: any) => void;
  onDelete: (request: any) => void;
  onClone: (request: any) => void;
  onAddToLiquidation?: (request: any) => void;
  canManage: boolean;
  onRefresh?: () => void;
}

export const RequestCard = ({ request, onEdit, onDelete, onClone, onAddToLiquidation, canManage, onRefresh }: RequestCardProps) => {
  const navigate = useNavigate();
  
  // Calculate total: cost_to_agency or calculate from hours/fixed
  const totalAmount = request.cost_to_agency || 
    (request.cost_type === 'hourly' 
      ? (request.hours || 0) * (request.cost_rate || 0) 
      : (request.fixed_cost || 0));

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-mono">{request.code}</p>
            <CardTitle className="text-lg mt-1">{request.title}</CardTitle>
          </div>
          <RequestStatusBadge status={request.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Flow Indicator */}
        <div className="py-2 border-y">
          <RequestFlowIndicator status={request.status} />
        </div>

        {request.client && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{request.client.name}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-sm">
          <Euro className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="font-semibold text-foreground">
            {formatCurrency(totalAmount)}
          </span>
        </div>

        {request.deadline && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span>
              Vence: {format(new Date(request.deadline), 'dd MMM yyyy', { locale: es })}
            </span>
          </div>
        )}

        {/* Invoice/Liquidation Status */}
        <div className="flex items-center gap-4 pt-2">
          <FlowStatusCell
            type="invoice"
            linkedId={request.billed_invoice_id}
            linkedCode={request.invoice?.code}
            linkedStatus={request.invoice?.status}
          />
          <FlowStatusCell
            type="liquidation"
            linkedId={request.liquidation_id}
            linkedCode={request.liquidation?.code}
            linkedStatus={request.liquidation?.status}
          />
        </div>

        {/* Flow Actions */}
        {canManage && (
          <div className="pt-3 border-t mt-3">
            <RequestFlowActions request={request} onSuccess={onRefresh} compact />
          </div>
        )}

        <div className="pt-2 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/solicitudes/${request.id}`)}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver Detalle
          </Button>
          {canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(request)}
                title="Editar"
              >
                <Edit className="h-4 w-4" />
              </Button>
              {!request.liquidation_id && onAddToLiquidation && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddToLiquidation(request)}
                  title="Añadir a Liquidación"
                >
                  <Receipt className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onClone(request)}
                title="Clonar"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(request)}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
