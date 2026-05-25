import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';
import { BudgetTableView } from '@/components/budgets/BudgetTableView';
import { BudgetFormModal } from '@/components/budgets/BudgetFormModal';

interface Props {
  clientId: string;
  canEdit: boolean;
}

export const ClientBudgetsTab = ({ clientId, canEdit }: Props) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['client-detail-budgets', clientId, statusFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('budgets')
        .select(`
          *,
          client:clients(id, name),
          client_contact:client_contacts(id, name),
          creator:profiles!budgets_created_by_fkey(id, full_name, email)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') query = query.eq('status', statusFilter as any);
      if (searchTerm) query = query.ilike('title', `%${searchTerm}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleClose = () => {
    setModalOpen(false);
    setSelected(null);
    queryClient.invalidateQueries({ queryKey: ['client-detail-budgets', clientId] });
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar presupuestos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="approved">Aprobado</SelectItem>
              <SelectItem value="invoiced">Facturado</SelectItem>
              <SelectItem value="rejected">Rechazado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setSelected(null);
              setModalMode('create');
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Presupuesto
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <BudgetTableView
          budgets={budgets || []}
          onView={(b) => {
            setSelected(b);
            setModalMode('view');
            setModalOpen(true);
          }}
          onEdit={
            canEdit
              ? (b) => {
                  setSelected(b);
                  setModalMode('edit');
                  setModalOpen(true);
                }
              : undefined
          }
        />
      )}

      <BudgetFormModal
        isOpen={modalOpen}
        onClose={handleClose}
        budget={selected || (modalMode === 'create' ? { client_id: clientId } : undefined)}
        mode={modalMode}
      />
    </div>
  );
};
