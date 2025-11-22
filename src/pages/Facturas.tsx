import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, LayoutGrid, Table as TableIcon, X, Download, FileDown } from 'lucide-react';
import { exportInvoicesToExcel } from '@/utils/excel/invoicesExporter';
import { generateInvoicePDF } from '@/utils/pdf/invoicePDFGenerator';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { InvoiceCard } from '@/components/invoices/InvoiceCard';
import { InvoiceTableView } from '@/components/invoices/InvoiceTableView';
import { InvoiceFormModal } from '@/components/modals/InvoiceFormModal';
import { useInvoiceFilters, PeriodType } from '@/hooks/useInvoiceFilters';

export default function Facturas() {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');

  const { canAccessFinance } = useUserRole();
  const { filters, updateFilter, resetFilters, getDateRange } = useInvoiceFilters();

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

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', filters],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange();
      
      let query = supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, name, code)
        `)
        .order('invoice_date', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status as any);
      }

      if (filters.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      if (filters.searchTerm) {
        query = query.or(`code.ilike.%${filters.searchTerm}%`);
      }

      if (filters.periodType !== 'custom' || (startDate && endDate)) {
        query = query
          .gte('invoice_date', startDate)
          .lte('invoice_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  if (!canAccessFinance()) {
    return (
      <AppLayout title="Facturas">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-destructive">No tienes permisos para acceder a esta sección</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const handleCreate = () => {
    setSelectedInvoice(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEdit = (invoice: any) => {
    setSelectedInvoice(invoice);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleView = (invoice: any) => {
    setSelectedInvoice(invoice);
    setModalMode('view');
    setModalOpen(true);
  };

  const hasActiveFilters = filters.searchTerm || filters.status || filters.clientId;

  return (
    <AppLayout title="Gestión de Facturas">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Facturas</h2>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Factura
          </Button>
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
                    <SelectItem value="overdue">Vencida</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
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

                <Select
                  value={filters.periodType}
                  onValueChange={(value) => updateFilter('periodType', value as PeriodType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this_month">Este mes</SelectItem>
                    <SelectItem value="last_month">Mes pasado</SelectItem>
                    <SelectItem value="this_year">Este año</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filters.periodType === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Input
                      type="date"
                      value={filters.startDate || ''}
                      onChange={(e) => updateFilter('startDate', e.target.value)}
                      placeholder="Desde"
                    />
                  </div>
                  <div>
                    <Input
                      type="date"
                      value={filters.endDate || ''}
                      onChange={(e) => updateFilter('endDate', e.target.value)}
                      placeholder="Hasta"
                    />
                  </div>
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
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!invoices || invoices.length === 0) {
                        toast.error('No hay datos para exportar');
                        return;
                      }
                      exportInvoicesToExcel(invoices, filters);
                      toast.success('Exportando a Excel...');
                    }}
                    disabled={!invoices || invoices.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
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
          <div className="flex justify-center py-8">
            <p className="text-muted-foreground">Cargando facturas...</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {invoices && invoices.length > 0 ? (
              invoices.map((invoice) => (
                <InvoiceCard
                  key={invoice.id}
                  invoice={invoice}
                  onEdit={handleEdit}
                  canManage={canAccessFinance()}
                />
              ))
            ) : (
              <Card className="col-span-full">
                <CardContent className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground">No hay facturas para mostrar</p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <InvoiceTableView
            invoices={invoices || []}
            onView={handleView}
            onEdit={handleEdit}
            canManage={canAccessFinance()}
          />
        )}
      </div>

      <InvoiceFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        invoice={selectedInvoice}
        mode={modalMode}
      />
    </AppLayout>
  );
}
