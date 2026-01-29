import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { 
  MoreHorizontal, 
  Eye, 
  Pencil, 
  CheckCircle, 
  Banknote, 
  Trash2,
  FileText,
  User,
  Briefcase
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

type CommissionType = 'sales' | 'am' | 'pm';

interface Commission {
  id: string;
  commission_type?: CommissionType;
  seller_user_id: string;
  contract_id: string | null;
  budget_id: string | null;
  invoice_ids?: string[];
  commission_percentage: number;
  commission_amount: number;
  base_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  notes: string | null;
  seller_profile?: { full_name: string; email: string } | null;
  contract?: { title: string; code: string; client?: { name: string } | null } | null;
  budget?: { title: string; code: string; client?: { name: string } | null } | null;
}

interface CommissionTableViewProps {
  commissions: Commission[];
  onView: (commission: Commission) => void;
  onEdit: (commission: Commission) => void;
  onRefresh: () => void;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
}

const commissionTypeLabels: Record<CommissionType, string> = {
  sales: 'Venta',
  am: 'AM',
  pm: 'PM',
};

const commissionTypeColors: Record<CommissionType, string> = {
  sales: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  am: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  pm: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

export function CommissionTableView({
  commissions,
  onView,
  onEdit,
  onRefresh,
  statusLabels,
  statusColors,
}: CommissionTableViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === 'paid') {
        updateData.paid_at = new Date().toISOString();
      }
      const { error } = await (supabase
        .from('sales_commissions' as any)
        .update(updateData)
        .eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-commissions'] });
      toast({ title: 'Estado actualizado', description: 'La comisión ha sido actualizada' });
      onRefresh();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from('sales_commissions' as any)
        .delete()
        .eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-commissions'] });
      toast({ title: 'Comisión eliminada', description: 'La comisión ha sido eliminada correctamente' });
      setDeleteId(null);
      onRefresh();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <TooltipProvider>
      <>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Beneficiario</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Facturas</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((commission) => {
                const source = commission.contract || commission.budget;
                const sourceType = commission.contract_id ? 'Contrato' : 'Presupuesto';
                const sourceCode = commission.contract?.code || commission.budget?.code || '';
                const invoiceCount = commission.invoice_ids?.length || 0;
                const commissionType = (commission.commission_type as CommissionType) || 'sales';

                return (
                  <TableRow key={commission.id}>
                    <TableCell>
                      <Badge className={commissionTypeColors[commissionType]}>
                        {commissionTypeLabels[commissionType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {commission.seller_profile?.full_name || 'Sin asignar'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 text-sm cursor-help">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{sourceCode}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{sourceType}: {source?.title}</p>
                          <p className="text-muted-foreground">{source?.client?.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {invoiceCount > 0 ? (
                        <div className="flex items-center gap-1 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{invoiceCount} factura{invoiceCount !== 1 ? 's' : ''}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(commission.base_amount).toLocaleString('es-ES', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {commission.commission_percentage}%
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(commission.commission_amount).toLocaleString('es-ES', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[commission.status]}>
                        {statusLabels[commission.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(commission.created_at), "d MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView(commission)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalles
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(commission)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {commission.status === 'pending' && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: commission.id, status: 'approved' })}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Aprobar
                            </DropdownMenuItem>
                          )}
                          {commission.status === 'approved' && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: commission.id, status: 'paid' })}
                            >
                              <Banknote className="h-4 w-4 mr-2" />
                              Marcar como pagada
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(commission.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar comisión?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La comisión será eliminada permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </TooltipProvider>
  );
}
