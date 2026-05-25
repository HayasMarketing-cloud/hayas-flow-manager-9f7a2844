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
import { ContractTableView } from '@/components/contracts/ContractTableView';
import { ContractFormModal } from '@/components/contracts/ContractFormModal';

interface Props {
  clientId: string;
  canEdit: boolean;
}

export const ClientContractsTab = ({ clientId, canEdit }: Props) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['client-detail-contracts', clientId, statusFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('contracts')
        .select('*, client:clients(id, name)')
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
    queryClient.invalidateQueries({ queryKey: ['client-detail-contracts', clientId] });
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contratos..."
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
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="suspended">Suspendido</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
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
            Nuevo Contrato
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
        <ContractTableView
          contracts={contracts || []}
          onView={(c) => {
            setSelected(c);
            setModalMode('view');
            setModalOpen(true);
          }}
          onEdit={
            canEdit
              ? (c) => {
                  setSelected(c);
                  setModalMode('edit');
                  setModalOpen(true);
                }
              : undefined
          }
        />
      )}

      <ContractFormModal
        isOpen={modalOpen}
        onClose={handleClose}
        contract={selected || (modalMode === 'create' ? { client_id: clientId } : undefined)}
        mode={modalMode}
      />
    </div>
  );
};
