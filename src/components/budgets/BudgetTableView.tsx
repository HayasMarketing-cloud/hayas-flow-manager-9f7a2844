import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BudgetStatusBadge } from './BudgetStatusBadge';
import { formatCurrency } from '@/lib/budget-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface BudgetTableViewProps {
  budgets: any[];
  onView: (budget: any) => void;
  onEdit?: (budget: any) => void;
  onDuplicate?: (budget: any) => void;
}

export const BudgetTableView = ({ budgets, onView, onEdit, onDuplicate }: BudgetTableViewProps) => {
  const navigate = useNavigate();
  
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Título</TableHead>
            <TableHead className="min-w-[150px]">Cliente</TableHead>
            <TableHead className="min-w-[120px]">Monto Total</TableHead>
            <TableHead className="min-w-[100px]">Estado</TableHead>
            <TableHead className="min-w-[120px]">Válido Hasta</TableHead>
            <TableHead className="text-right min-w-[150px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {budgets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No se encontraron presupuestos
              </TableCell>
            </TableRow>
          ) : (
            budgets.map((budget) => (
              <TableRow key={budget.id}>
                <TableCell className="font-medium">{budget.title}</TableCell>
                <TableCell>{budget.client?.name || 'Sin cliente'}</TableCell>
                <TableCell>{formatCurrency(budget.total_amount || 0)}</TableCell>
                <TableCell>
                  <BudgetStatusBadge status={budget.status} />
                </TableCell>
                <TableCell>
                  {budget.valid_until
                    ? format(new Date(budget.valid_until), 'dd/MM/yyyy', { locale: es })
                    : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/presupuestos/${budget.id}`)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {onEdit && budget.status === 'pending' && (
                      <Button variant="ghost" size="sm" onClick={() => onEdit(budget)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onDuplicate && (
                      <Button variant="ghost" size="sm" onClick={() => onDuplicate(budget)}>
                        <Copy className="h-4 w-4" />
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
