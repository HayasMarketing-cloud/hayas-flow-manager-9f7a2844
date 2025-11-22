import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Play, Pause, RotateCw } from 'lucide-react';
import { ContractStatusBadge } from './ContractStatusBadge';
import { formatCurrency } from '@/lib/contract-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">{contract.title}</h3>
            <p className="text-sm text-muted-foreground">
              {contract.client?.name || 'Sin cliente'}
            </p>
          </div>
          <ContractStatusBadge status={contract.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Monto Total</p>
            <p className="font-semibold text-lg">
              {formatCurrency(contract.total_amount || 0)}
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
        {onEdit && contract.status === 'draft' && (
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
        {onGenerateRequests && contract.status === 'active' && (
          <Button variant="default" size="sm" onClick={() => onGenerateRequests(contract)}>
            <RotateCw className="h-4 w-4 mr-2" />
            Generar Requests
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
