import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Copy, FileText, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { BudgetStatusBadge } from './BudgetStatusBadge';
import { formatCurrency } from '@/lib/budget-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface BudgetCardProps {
  budget: any;
  onView: (budget: any) => void;
  onEdit?: (budget: any) => void;
  onDuplicate?: (budget: any) => void;
  onConvertToContract?: (budget: any) => void;
  onDelete?: (budget: any) => void;
}

export const BudgetCard = ({ budget, onView, onEdit, onDuplicate, onConvertToContract, onDelete }: BudgetCardProps) => {
  const navigate = useNavigate();
  
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            {budget.code && (
              <span className="text-xs font-mono text-muted-foreground">{budget.code}</span>
            )}
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{budget.title}</h3>
              {budget.accepted_document_url && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <FileText className="h-4 w-4 text-green-600" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Documento aceptado enlazado</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {budget.client?.name || 'Sin cliente'}
            </p>
          </div>
          <BudgetStatusBadge status={budget.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Monto Total</p>
            <p className="font-semibold text-lg">
              {formatCurrency(budget.total_amount || 0)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Válido Hasta</p>
            <p className="font-medium">
              {budget.valid_until
                ? format(new Date(budget.valid_until), 'dd MMM yyyy', { locale: es })
                : 'No especificado'}
            </p>
          </div>
        </div>
        {budget.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {budget.description}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate(`/presupuestos/${budget.id}`)} className="flex-1">
          <Eye className="h-4 w-4 mr-2" />
          Ver Detalle
        </Button>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={() => onEdit(budget)}>
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {onDuplicate && (
          <Button variant="outline" size="sm" onClick={() => onDuplicate(budget)}>
            <Copy className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button variant="outline" size="sm" onClick={() => onDelete(budget)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
