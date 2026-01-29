import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { RoleBasedRoute } from '@/components/RoleBasedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search, DollarSign, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CommissionFormModal } from '@/components/commissions/CommissionFormModal';
import { CommissionCard } from '@/components/commissions/CommissionCard';
import { CommissionTableView } from '@/components/commissions/CommissionTableView';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type CommissionType = 'sales' | 'am' | 'pm';
type CommissionStatus = 'pending' | 'approved' | 'paid';

const statusLabels: Record<CommissionStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  paid: 'Pagada',
};

const statusColors: Record<CommissionStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const commissionTypeLabels: Record<CommissionType, string> = {
  sales: 'Venta',
  am: 'Account Manager',
  pm: 'Project Manager',
};

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
  status: CommissionStatus;
  paid_at: string | null;
  created_at: string;
  notes: string | null;
  seller_profile?: { full_name: string; email: string } | null;
  contract?: { title: string; code: string; client?: { name: string } | null } | null;
  budget?: { title: string; code: string; client?: { name: string } | null } | null;
}

function ComisionesContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  const { data: commissions, isLoading, refetch } = useQuery({
    queryKey: ['sales-commissions', statusFilter, typeFilter],
    queryFn: async () => {
      // Use raw query since types may not be updated yet
      let query = supabase
        .from('sales_commissions' as any)
        .select(`
          *,
          contract:contracts(id, title, code, client:clients(name)),
          budget:budgets(id, title, code, client:clients(name))
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (typeFilter !== 'all') {
        query = query.eq('commission_type', typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch seller profiles separately
      const sellerIds = [...new Set((data || []).map((c: any) => c.seller_user_id))];
      
      if (sellerIds.length === 0) {
        return [] as Commission[];
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', sellerIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return (data || []).map((c: any) => ({
        ...c,
        seller_profile: profilesMap.get(c.seller_user_id) || null,
      })) as Commission[];
    },
  });

  const filteredCommissions = commissions?.filter(commission => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const sellerName = commission.seller_profile?.full_name?.toLowerCase() || '';
    const contractTitle = commission.contract?.title?.toLowerCase() || '';
    const budgetTitle = commission.budget?.title?.toLowerCase() || '';
    const clientName = commission.contract?.client?.name?.toLowerCase() || 
                       commission.budget?.client?.name?.toLowerCase() || '';
    return sellerName.includes(query) || contractTitle.includes(query) || 
           budgetTitle.includes(query) || clientName.includes(query);
  }) || [];

  const handleCreate = () => {
    setSelectedCommission(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleView = (commission: Commission) => {
    setSelectedCommission(commission);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleEdit = (commission: Commission) => {
    setSelectedCommission(commission);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCommission(null);
  };

  const handleSuccess = () => {
    refetch();
    handleModalClose();
  };

  // Calculate summary stats
  const totalPending = filteredCommissions
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + Number(c.commission_amount), 0);
  const totalApproved = filteredCommissions
    .filter(c => c.status === 'approved')
    .reduce((sum, c) => sum + Number(c.commission_amount), 0);
  const totalPaid = filteredCommissions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + Number(c.commission_amount), 0);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Comisiones de Ventas</h1>
            <p className="text-muted-foreground mt-2">
              Gestiona las comisiones de ventas por contratos y presupuestos
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Comisión
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Comisiones</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(totalPending + totalApproved + totalPaid).toLocaleString('es-ES', { 
                  style: 'currency', 
                  currency: 'EUR' 
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredCommissions.length} comisiones
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {totalPending.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredCommissions.filter(c => c.status === 'pending').length} pendientes
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aprobadas</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {totalApproved.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredCommissions.filter(c => c.status === 'approved').length} aprobadas
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagadas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {totalPaid.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredCommissions.filter(c => c.status === 'paid').length} pagadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por vendedor, contrato o cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="am">Account Manager</SelectItem>
                  <SelectItem value="pm">Project Manager</SelectItem>
                  <SelectItem value="sales">Venta</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="approved">Aprobada</SelectItem>
                  <SelectItem value="paid">Pagada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'cards' | 'table')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="table">Vista tabla</SelectItem>
                  <SelectItem value="cards">Vista tarjetas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Commission List */}
        {filteredCommissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No hay comisiones</h3>
              <p className="text-muted-foreground mt-1">
                {searchQuery || statusFilter !== 'all' 
                  ? 'No se encontraron comisiones con los filtros aplicados' 
                  : 'Crea tu primera comisión de ventas'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button className="mt-4" onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Comisión
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'table' ? (
          <CommissionTableView
            commissions={filteredCommissions}
            onView={handleView}
            onEdit={handleEdit}
            onRefresh={refetch}
            statusLabels={statusLabels}
            statusColors={statusColors}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCommissions.map((commission) => (
              <CommissionCard
                key={commission.id}
                commission={commission}
                onView={() => handleView(commission)}
                onEdit={() => handleEdit(commission)}
                statusLabels={statusLabels}
                statusColors={statusColors}
              />
            ))}
          </div>
        )}
      </div>

      <CommissionFormModal
        open={isModalOpen}
        onOpenChange={handleModalClose}
        commission={selectedCommission}
        mode={modalMode}
        onSuccess={handleSuccess}
      />
    </AppLayout>
  );
}

export default function Comisiones() {
  return (
    <RoleBasedRoute allowedRoles={['admin', 'finanzas']}>
      <ComisionesContent />
    </RoleBasedRoute>
  );
}
