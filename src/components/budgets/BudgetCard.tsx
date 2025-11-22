import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Copy } from 'lucide-react';
import { BudgetStatusBadge } from './BudgetStatusBadge';
import { formatCurrency } from '@/lib/budget-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface BudgetCardProps {
  budget: any;
  onView: (budget: any) => void;
  onEdit?: (budget: any) => void;
  onDuplicate?: (budget: any) => void;
}

export const BudgetCard = ({ budget, onView, onEdit, onDuplicate }: BudgetCardProps) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">{budget.title}</h3>
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
        <Button variant="outline" size="sm" onClick={() => onView(budget)} className="flex-1">
          <Eye className="h-4 w-4 mr-2" />
          Ver
        </Button>
        {onEdit && budget.status === 'pending' && (
          <Button variant="outline" size="sm" onClick={() => onEdit(budget)}>
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {onDuplicate && (
          <Button variant="outline" size="sm" onClick={() => onDuplicate(budget)}>
            <Copy className="h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
