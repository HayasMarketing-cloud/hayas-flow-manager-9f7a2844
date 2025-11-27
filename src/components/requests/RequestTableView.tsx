import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RequestStatusBadge } from './RequestStatusBadge';
import { Edit, Eye } from 'lucide-react';
import { formatCurrency } from '@/lib/request-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RequestTableViewProps {
  requests: any[];
  onEdit: (request: any) => void;
  canManage: boolean;
}

export const RequestTableView = ({
  requests,
  onEdit,
  canManage,
}: RequestTableViewProps) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Servicio</TableHead>
            <TableHead>Especialista</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Coste (€)</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                No se encontraron solicitudes
              </TableCell>
            </TableRow>
          ) : (
            requests.map((request) => {
              // Calculate total: cost_to_agency or calculate from hours/fixed
              const totalAmount = request.cost_to_agency || 
                (request.cost_type === 'hourly' 
                  ? (request.hours || 0) * (request.cost_rate || 0) 
                  : (request.fixed_cost || 0));
              
              return (
                <TableRow key={request.id}>
                  <TableCell className="font-mono text-xs">{request.code}</TableCell>
                  <TableCell className="font-medium">{request.title}</TableCell>
                  <TableCell>{request.client?.name || '-'}</TableCell>
                  <TableCell>{request.service?.name || '-'}</TableCell>
                  <TableCell>{request.specialist?.name || '-'}</TableCell>
                  <TableCell>
                    <RequestStatusBadge status={request.status} />
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(totalAmount)}
                  </TableCell>
                  <TableCell>
                    {format(new Date(request.created_at), 'dd/MM/yyyy', { locale: es })}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(request)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(request)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
