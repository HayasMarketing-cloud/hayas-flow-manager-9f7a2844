import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RequestStatusBadge } from './RequestStatusBadge';
import { Edit, Building2, Briefcase, Calendar, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/request-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RequestCardProps {
  request: any;
  onEdit: (request: any) => void;
  canManage: boolean;
}

export const RequestCard = ({ request, onEdit, canManage }: RequestCardProps) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{request.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{request.code}</p>
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DollarSign className="h-4 w-4 flex-shrink-0" />
          <span className="font-semibold text-foreground">
            {formatCurrency(request.total)}
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
