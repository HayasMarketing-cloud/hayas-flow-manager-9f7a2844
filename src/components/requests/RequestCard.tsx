import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RequestStatusBadge } from './RequestStatusBadge';
import { Edit, Building2, Briefcase, Calendar, Euro, User } from 'lucide-react';
import { formatCurrency } from '@/lib/request-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RequestCardProps {
  request: any;
  onEdit: (request: any) => void;
  canManage: boolean;
}

export const RequestCard = ({ request, onEdit, canManage }: RequestCardProps) => {
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
        {request.client && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{request.client.name}</span>
          </div>
        )}
        {request.service && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Briefcase className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{request.service.name}</span>
          </div>
        )}
        {request.specialist && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{request.specialist.name}</span>
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
        {canManage && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(request)}
              className="w-full"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
