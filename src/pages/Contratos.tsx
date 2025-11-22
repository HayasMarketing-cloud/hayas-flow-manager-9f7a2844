import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { LayoutGrid, Table as TableIcon, Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useContractFilters } from '@/hooks/useContractFilters';
import { ContractCard } from '@/components/contracts/ContractCard';
import { ContractTableView } from '@/components/contracts/ContractTableView';
import { ContractFormModal } from '@/components/contracts/ContractFormModal';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export default function Contratos() {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');

  const { user } = useAuth();
  const { filters, updateFilter, resetFilters } = useContractFilters();
  const queryClient = useQueryClient();

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['contracts', filters],
    queryFn: async () => {
      let query = supabase
        .from('contracts')
        .select(`
          *,
          client:clients(id, name)
        `)
        .order('created_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters.searchTerm) {
        query = query.or(`title.ilike.%${filters.searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ contractId, newStatus }: { contractId: string; newStatus: string }) => {
      const { error } = await supabase
        .from('contracts')
        .update({ status: newStatus })
        .eq('id', contractId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Estado actualizado correctamente');
    },
    onError: (error: any) => {
      toast.error('Error al cambiar el estado: ' + error.message);
    },
  });

  const handleCreate = () => {
    setSelectedContract(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleView = (contract: any) => {
    setSelectedContract(contract);
    setModalMode('view');
    setModalOpen(true);
  };

  const handleEdit = (contract: any) => {
    setSelectedContract(contract);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleActivate = (contract: any) => {
    changeStatusMutation.mutate({ contractId: contract.id, newStatus: 'active' });
  };

  const handleSuspend = (contract: any) => {
    changeStatusMutation.mutate({ contractId: contract.id, newStatus: 'suspended' });
  };

  const handleResume = (contract: any) => {
    changeStatusMutation.mutate({ contractId: contract.id, newStatus: 'active' });
  };

  const handleGenerateRequests = (contract: any) => {
    setSelectedContract(contract);
    setModalMode('view');
    setModalOpen(true);
  };

  const hasActiveFilters = filters.searchTerm || filters.status || filters.clientId;

  return (
    <AppLayout title="Contratos" description="Gestión de contratos">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Contratos</h2>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Contrato
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Input
                    placeholder="Buscar por título..."
                    value={filters.searchTerm}
                    onChange={(e) => updateFilter('searchTerm', e.target.value)}
                    className="pr-8"
                  />
                  {filters.searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => updateFilter('searchTerm', '')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <Select
                  value={filters.status || 'all'}
                  onValueChange={(value) => updateFilter('status', value === 'all' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="suspended">Suspendido</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.clientId || 'all'}
                  onValueChange={(value) => updateFilter('clientId', value === 'all' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      <X className="h-4 w-4 mr-2" />
                      Limpiar filtros
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === 'cards' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('cards')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                  >
                    <TableIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : contracts && contracts.length > 0 ? (
          viewMode === 'cards' ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {contracts.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  onView={handleView}
                  onEdit={handleEdit}
                  onActivate={handleActivate}
                  onSuspend={handleSuspend}
                  onResume={handleResume}
                  onGenerateRequests={handleGenerateRequests}
                />
              ))}
            </div>
          ) : (
            <ContractTableView
              contracts={contracts}
              onView={handleView}
              onEdit={handleEdit}
              onActivate={handleActivate}
              onSuspend={handleSuspend}
              onResume={handleResume}
              onGenerateRequests={handleGenerateRequests}
            />
          )
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">No se encontraron contratos</p>
            </CardContent>
          </Card>
        )}
      </div>

      <ContractFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        contract={selectedContract}
        mode={modalMode}
      />
    </AppLayout>
  );
}
