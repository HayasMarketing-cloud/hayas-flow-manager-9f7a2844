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
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No se encontraron solicitudes
              </TableCell>
            </TableRow>
          ) : (
            requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="font-medium">{request.code}</TableCell>
                <TableCell>{request.title}</TableCell>
                <TableCell>{request.client?.name || '-'}</TableCell>
                <TableCell>{request.service?.name || '-'}</TableCell>
                <TableCell>
                  <RequestStatusBadge status={request.status} />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(request.total)}
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
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
