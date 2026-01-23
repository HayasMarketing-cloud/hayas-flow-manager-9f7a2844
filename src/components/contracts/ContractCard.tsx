import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Edit, Play, Pause, RotateCw, RefreshCw, FolderKanban } from 'lucide-react';
import { ContractStatusBadge } from './ContractStatusBadge';
import { formatCurrency } from '@/lib/contract-utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface ContractCardProps {
  contract: any;
  onView: (contract: any) => void;
  onEdit?: (contract: any) => void;
  onActivate?: (contract: any) => void;
  onSuspend?: (contract: any) => void;
  onResume?: (contract: any) => void;
  onGenerateRequests?: (contract: any) => void;
}

export const ContractCard = ({
  contract,
  onView,
  onEdit,
  onActivate,
  onSuspend,
  onResume,
  onGenerateRequests,
}: ContractCardProps) => {
  const navigate = useNavigate();

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            {contract.code && (
              <Badge variant="outline" className="font-mono text-xs mb-1">
                {contract.code}
              </Badge>
            )}
            <h3 className="font-semibold text-lg truncate">{contract.title}</h3>
            <p className="text-sm text-muted-foreground">
              {contract.client?.name || 'Sin cliente'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ContractStatusBadge status={contract.status} />
            {contract.enable_auto_requests && (
              <Badge variant="secondary" className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                Auto
              </Badge>
            )}
            {contract.operationalProject && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className="text-xs cursor-pointer bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/proyectos-operativos/${contract.operationalProject.id}`);
                    }}
                  >
                    <FolderKanban className="h-3 w-3 mr-1" />
                    Proyecto
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{contract.operationalProject.name}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Tipo</p>
            <p className="font-semibold text-lg">
              {contract.contract_type === 'retainer' && 'Retainer'}
              {contract.contract_type === 'project' && 'Por Proyecto'}
              {contract.contract_type === 'one_time' && 'Puntual'}
              {!contract.contract_type && 'Sin definir'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Período</p>
            <p className="font-medium">
              {contract.start_date && contract.end_date
                ? `${format(new Date(contract.start_date), 'dd/MM/yy')} - ${format(
                    new Date(contract.end_date),
                    'dd/MM/yy'
                  )}`
                : 'No especificado'}
            </p>
          </div>
        </div>
        {contract.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {contract.description}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onView(contract)} className="flex-1">
          <Eye className="h-4 w-4 mr-2" />
          Ver
        </Button>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={() => onEdit(contract)}>
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {onActivate && contract.status === 'draft' && (
          <Button variant="outline" size="sm" onClick={() => onActivate(contract)}>
            <Play className="h-4 w-4" />
          </Button>
        )}
        {onSuspend && contract.status === 'active' && (
          <Button variant="outline" size="sm" onClick={() => onSuspend(contract)}>
            <Pause className="h-4 w-4" />
          </Button>
        )}
        {onResume && contract.status === 'suspended' && (
          <Button variant="outline" size="sm" onClick={() => onResume(contract)}>
            <Play className="h-4 w-4" />
          </Button>
        )}
        {onGenerateRequests && contract.status === 'active' && contract.enable_auto_requests && (
          <Button variant="default" size="sm" onClick={() => onGenerateRequests(contract)}>
            <RotateCw className="h-4 w-4 mr-2" />
            Generar Requests
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
