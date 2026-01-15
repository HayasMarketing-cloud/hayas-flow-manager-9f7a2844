import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { LayoutGrid, Table as TableIcon, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLiquidationFilters, PeriodType } from '@/hooks/useLiquidationFilters';
import { LiquidationCard } from '@/components/liquidations/LiquidationCard';
import { LiquidationTableView } from '@/components/liquidations/LiquidationTableView';
import { LiquidationFormModal } from '@/components/liquidations/LiquidationFormModal';
import { Skeleton } from '@/components/ui/skeleton';

export default function MisLiquidaciones() {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLiquidation, setSelectedLiquidation] = useState<any>(null);
  
  const { user } = useAuth();
  const { filters, updateFilter, resetFilters } = useLiquidationFilters();

  // Obtener el especialista actual
  const { data: currentSpecialist, isLoading: specialistLoading } = useQuery({
    queryKey: ['current-specialist', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Obtener las liquidaciones del especialista
  const { data: liquidations, isLoading } = useQuery({
    queryKey: ['my-liquidations', currentSpecialist?.id, filters],
    queryFn: async () => {
      if (!currentSpecialist?.id) return [];

      let query = supabase
        .from('liquidations')
        .select(`
          *,
          specialist:specialists(id, name)
        `)
        .eq('specialist_id', currentSpecialist.id)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
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
    enabled: !!currentSpecialist?.id,
  });

  const handleView = (liquidation: any) => {
    setSelectedLiquidation(liquidation);
    setModalOpen(true);
  };

  if (specialistLoading) {
    return (
      <AppLayout title="Mis Liquidaciones">
        <div className="flex justify-center py-8">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </AppLayout>
    );
  }

  if (!currentSpecialist) {
    return (
      <AppLayout title="Mis Liquidaciones">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <p className="text-destructive">No se encontró un perfil de especialista asociado a tu usuario</p>
              <p className="text-sm text-muted-foreground">
                Contacta con un administrador para que te asigne un perfil de especialista
              </p>
            </div>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const hasActiveFilters = filters.searchTerm || filters.status || filters.periodType !== 'current_month';

  return (
    <AppLayout title="Mis Liquidaciones">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Mis Liquidaciones</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Especialista: {currentSpecialist.name}
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <SelectItem value="validated">Validada</SelectItem>
                    <SelectItem value="sent">Enviada</SelectItem>
                    <SelectItem value="accepted">Aceptada</SelectItem>
                    <SelectItem value="pending_payment">Pendiente de pago</SelectItem>
                    <SelectItem value="paid">Pagada</SelectItem>
                  </SelectContent>
                </Select>

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
                  canManage={false}
                />
              ))}
            </div>
          ) : (
            <LiquidationTableView
              liquidations={liquidations}
              onView={handleView}
              onEdit={() => {}}
              onDelete={() => {}}
              canManage={false}
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
        mode="view"
      />
    </AppLayout>
  );
}
