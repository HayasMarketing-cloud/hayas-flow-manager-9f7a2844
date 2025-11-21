import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, LayoutGrid, Table as TableIcon, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useLiquidationFilters, PeriodType } from '@/hooks/useLiquidationFilters';
import { LiquidationCard } from '@/components/liquidations/LiquidationCard';
import { LiquidationTableView } from '@/components/liquidations/LiquidationTableView';
import { LiquidationFormModal } from '@/components/liquidations/LiquidationFormModal';
import { Skeleton } from '@/components/ui/skeleton';

export default function Liquidaciones() {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLiquidation, setSelectedLiquidation] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  
  const { filters, updateFilter, resetFilters } = useLiquidationFilters();
  const { canAccessFinance, loading: rolesLoading } = useUserRole();

  const { data: liquidations, isLoading } = useQuery({
    queryKey: ['liquidations', filters],
    queryFn: async () => {
      let query = supabase
        .from('liquidations')
        .select(`
          *,
          specialist:specialists(id, name)
        `)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.specialistId) {
        query = query.eq('specialist_id', filters.specialistId);
      }
      if (filters.searchTerm) {
        query = query.or(`code.ilike.%${filters.searchTerm}%`);
      }

      // Filtro de período
      if (filters.month && filters.year) {
        query = query.eq('period_year', filters.year).eq('period_month', filters.month);
      } else if (filters.year) {
        query = query.eq('period_year', filters.year);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: specialists } = useQuery({
    queryKey: ['specialists-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  if (!rolesLoading && !canAccessFinance()) {
    return (
      <AppLayout title="Liquidaciones">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-destructive">No tienes permisos para acceder a esta sección</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const handleCreate = () => {
    setSelectedLiquidation(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEdit = (liquidation: any) => {
    setSelectedLiquidation(liquidation);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleView = (liquidation: any) => {
    setSelectedLiquidation(liquidation);
    setModalMode('view');
    setModalOpen(true);
  };

  const hasActiveFilters = filters.searchTerm || filters.status || filters.specialistId || filters.periodType !== 'current_month';

  return (
    <AppLayout title="Gestión de Liquidaciones">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Liquidaciones</h2>
          {canAccessFinance() && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Liquidación
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Input
                    placeholder="Buscar por código..."
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
                  onValueChange={(value) => updateFilter('status', value === 'all' ? null : value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="sent">Enviada</SelectItem>
                    <SelectItem value="paid">Pagada</SelectItem>
                    <SelectItem value="disputed">En Disputa</SelectItem>
                  </SelectContent>
                </Select>

                {specialists && specialists.length > 0 && (
                  <Select
                    value={filters.specialistId || 'all'}
                    onValueChange={(value) => updateFilter('specialistId', value === 'all' ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los especialistas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los especialistas</SelectItem>
                      {specialists.map((specialist) => (
                        <SelectItem key={specialist.id} value={specialist.id}>
                          {specialist.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select
                  value={filters.periodType}
                  onValueChange={(value) => updateFilter('periodType', value as PeriodType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current_month">Mes actual</SelectItem>
                    <SelectItem value="last_month">Mes pasado</SelectItem>
                    <SelectItem value="current_year">Año actual</SelectItem>
                    <SelectItem value="last_year">Año pasado</SelectItem>
                    <SelectItem value="all">Todos los períodos</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filters.periodType === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    value={filters.year?.toString() || ''}
                    onValueChange={(value) => updateFilter('year', value ? parseInt(value) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Año" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.month?.toString() || ''}
                    onValueChange={(value) => updateFilter('month', value ? parseInt(value) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Mes (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Todos los meses</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <SelectItem key={month} value={month.toString()}>
                          {new Date(2024, month - 1).toLocaleDateString('es-ES', { month: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
        ) : liquidations && liquidations.length > 0 ? (
          viewMode === 'cards' ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {liquidations.map((liquidation) => (
                <LiquidationCard
                  key={liquidation.id}
                  liquidation={liquidation}
                  onView={handleView}
                  onEdit={handleEdit}
                  canManage={canAccessFinance()}
                />
              ))}
            </div>
          ) : (
            <LiquidationTableView
              liquidations={liquidations}
              onView={handleView}
              onEdit={handleEdit}
              canManage={canAccessFinance()}
            />
          )
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">No se encontraron liquidaciones</p>
            </CardContent>
          </Card>
        )}
      </div>

      <LiquidationFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        liquidation={selectedLiquidation}
        mode={modalMode}
      />
    </AppLayout>
  );
}
