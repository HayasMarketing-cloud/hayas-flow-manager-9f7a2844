import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RequestStatusBadge } from './RequestStatusBadge';
import { Edit, Eye, Copy, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/request-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RequestTableViewProps {
  requests: any[];
  onEdit: (request: any) => void;
  onDelete: (request: any) => void;
  onClone: (request: any) => void;
  canManage: boolean;
  selectedIds: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
}

export const RequestTableView = ({
  requests,
  onEdit,
  onDelete,
  onClone,
  canManage,
  selectedIds,
  onSelectAll,
  onSelectOne,
}: RequestTableViewProps) => {
  const allSelected = requests.length > 0 && selectedIds.length === requests.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < requests.length;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
                aria-label="Seleccionar todo"
                {...(someSelected ? { 'data-state': 'indeterminate' } : {})}
              />
            </TableHead>
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
              <TableCell colSpan={10} className="text-center text-muted-foreground">
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
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(request.id)}
                      onCheckedChange={(checked) => onSelectOne(request.id, !!checked)}
                      aria-label={`Seleccionar ${request.title}`}
                    />
                  </TableCell>
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
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(request)}
                        title={canManage ? 'Editar' : 'Ver'}
                      >
                        {canManage ? <Edit className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onClone(request)}
                            title="Clonar"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(request)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
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
