import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Expense, useExpenses } from '@/hooks/useExpenses';
import { ExpenseFormModal } from './ExpenseFormModal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/contexts/AuthContext';

const formatCurrency = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);

const categoryColors: Record<string, string> = {
  software: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  oficina: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  servicios: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  seguros: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  telecomunicaciones: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  marketing: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  otros: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

export function ExpenseRegistryTab() {
  const { data: expenses = [], isLoading, createExpense, updateExpense, deleteExpense } = useExpenses();
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [toDelete, setToDelete] = useState<Expense | null>(null);

  const handleSave = (data: any) => {
    if (selected) {
      updateExpense.mutate({ id: selected.id, ...data });
    } else {
      createExpense.mutate({ ...data, created_by: user?.id });
    }
  };

  const handleEdit = (exp: Expense) => { setSelected(exp); setModalOpen(true); };
  const handleNew = () => { setSelected(null); setModalOpen(true); };

  const totalMonthly = expenses.filter(e => e.is_active).reduce((s, e) => s + e.monthly_cost, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Total mensual activo: <span className="font-semibold text-foreground">{formatCurrency(totalMonthly)}</span>
          {' · '}Total anual: <span className="font-semibold text-foreground">{formatCurrency(totalMonthly * 12)}</span>
        </p>
        <Button onClick={handleNew} size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo Gasto</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Periodicidad</TableHead>
              <TableHead className="text-right">Coste/mes</TableHead>
              <TableHead>Renovación</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Web</TableHead>
              <TableHead className="w-20">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
            ) : expenses.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No hay gastos registrados</TableCell></TableRow>
            ) : expenses.map(exp => (
              <TableRow key={exp.id} className={!exp.is_active ? 'opacity-50' : ''}>
                <TableCell className="font-medium">{exp.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={categoryColors[exp.category] || categoryColors.otros}>
                    {exp.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={exp.is_active ? 'default' : 'secondary'}>
                    {exp.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">{exp.periodicity === 'monthly' ? 'Mensual' : exp.periodicity === 'annual' ? 'Anual' : 'Trimestral'}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(exp.monthly_cost)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{exp.renewal_month || '—'}</TableCell>
                <TableCell className="text-sm truncate max-w-[150px]">{exp.account_email || '—'}</TableCell>
                <TableCell>
                  {exp.website_url ? (
                    <a href={exp.website_url.startsWith('http') ? exp.website_url : `https://${exp.website_url}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </a>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(exp)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { setToDelete(exp); setDeleteDialog(true); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ExpenseFormModal open={modalOpen} onOpenChange={setModalOpen} expense={selected} onSave={handleSave} />
      <ConfirmDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        title="Eliminar gasto"
        description={`¿Eliminar "${toDelete?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={() => { if (toDelete) deleteExpense.mutate(toDelete.id); setDeleteDialog(false); }}
      />
    </div>
  );
}
