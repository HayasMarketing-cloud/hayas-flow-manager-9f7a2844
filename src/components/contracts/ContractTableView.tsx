import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Edit, Play, Pause, RotateCw, RefreshCw, FolderKanban } from 'lucide-react';
import { ContractStatusBadge } from './ContractStatusBadge';
import { formatCurrency } from '@/lib/contract-utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface ContractTableViewProps {
  contracts: any[];
  onView: (contract: any) => void;
  onEdit?: (contract: any) => void;
  onActivate?: (contract: any) => void;
  onSuspend?: (contract: any) => void;
  onResume?: (contract: any) => void;
  onGenerateRequests?: (contract: any) => void;
}

export const ContractTableView = ({
  contracts,
  onView,
  onEdit,
  onActivate,
  onSuspend,
  onResume,
  onGenerateRequests,
}: ContractTableViewProps) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Monto Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Proyecto</TableHead>
            <TableHead>Inicio - Fin</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No se encontraron contratos
              </TableCell>
            </TableRow>
          ) : (
            contracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {contract.code || '-'}
                    </code>
                    {contract.enable_auto_requests && (
                      <Badge variant="secondary" className="text-xs px-1">
                        <RefreshCw className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{contract.title}</TableCell>
                <TableCell>{contract.client?.name || 'Sin cliente'}</TableCell>
                <TableCell>{formatCurrency(contract.total_amount || 0)}</TableCell>
                <TableCell>
                  <ContractStatusBadge status={contract.status} />
                </TableCell>
                <TableCell>
                  {contract.operationalProject ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => navigate(`/proyectos-operativos/${contract.operationalProject.id}`)}
                        >
                          <FolderKanban className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{contract.operationalProject.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {contract.start_date && contract.end_date
                    ? `${format(new Date(contract.start_date), 'dd/MM/yyyy')} - ${format(
                        new Date(contract.end_date),
                        'dd/MM/yyyy'
                      )}`
                    : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onView(contract)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {onEdit && (
                      <Button variant="ghost" size="sm" onClick={() => onEdit(contract)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onActivate && contract.status === 'draft' && (
                      <Button variant="ghost" size="sm" onClick={() => onActivate(contract)}>
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {onSuspend && contract.status === 'active' && (
                      <Button variant="ghost" size="sm" onClick={() => onSuspend(contract)}>
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    {onResume && contract.status === 'suspended' && (
                      <Button variant="ghost" size="sm" onClick={() => onResume(contract)}>
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {onGenerateRequests && contract.status === 'active' && contract.enable_auto_requests && (
                      <Button variant="ghost" size="sm" onClick={() => onGenerateRequests(contract)}>
                        <RotateCw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
