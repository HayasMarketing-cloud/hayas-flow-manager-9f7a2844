import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Copy, FileText, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  onDelete?: (budget: any) => void;
}

export const BudgetTableView = ({ budgets, onView, onEdit, onDuplicate, onDelete }: BudgetTableViewProps) => {
  const navigate = useNavigate();
  
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[100px]">Código</TableHead>
            <TableHead className="min-w-[200px]">Título</TableHead>
            <TableHead className="min-w-[150px]">Cliente</TableHead>
            <TableHead className="min-w-[120px]">Monto Total</TableHead>
            <TableHead className="min-w-[100px]">Estado</TableHead>
            <TableHead className="min-w-[120px]">Fecha Facturación</TableHead>
            <TableHead className="text-right min-w-[150px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {budgets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No se encontraron presupuestos
              </TableCell>
            </TableRow>
          ) : (
            budgets.map((budget) => (
              <TableRow key={budget.id}>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {budget.code || '-'}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {budget.title}
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
                </TableCell>
                <TableCell>{budget.client?.name || 'Sin cliente'}</TableCell>
                <TableCell>{formatCurrency(budget.total_amount || 0)}</TableCell>
                <TableCell>
                  <BudgetStatusBadge status={budget.status} />
                </TableCell>
                <TableCell>
                  {budget.estimated_invoice_date
                    ? format(new Date(budget.estimated_invoice_date), 'dd/MM/yyyy', { locale: es })
                    : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/presupuestos/${budget.id}`)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {onEdit && (
                      <Button variant="ghost" size="sm" onClick={() => onEdit(budget)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onDuplicate && (
                      <Button variant="ghost" size="sm" onClick={() => onDuplicate(budget)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button variant="ghost" size="sm" onClick={() => onDelete(budget)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
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
