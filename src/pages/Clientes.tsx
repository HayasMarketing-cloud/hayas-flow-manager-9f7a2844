import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Mail, Phone, MapPin, Edit } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClientFormModal } from '@/components/modals/ClientFormModal';
import { useUserRole } from '@/hooks/useUserRole';
import { useCurrentSpecialist } from '@/hooks/useCurrentSpecialist';
import { useAssignedClients } from '@/hooks/useAssignedClients';
import GoogleDriveIcon from '@/assets/icons8-google-drive.svg';

const Clientes = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canManageClients, canEditAssignedClients, isSpecialist, isAdmin, canAccessFinance, isProjectManager, shouldFilterByAssignment, loading: rolesLoading } = useUserRole();
  const { specialistId, isLoading: specialistLoading } = useCurrentSpecialist();
  const { assignedClientIds, isLoading: assignedLoading, needsFiltering } = useAssignedClients();
  const canManage = canManageClients();
  const canEdit = canManage || canEditAssignedClients();
  
  // Check if user is only specialist (no other management roles)
  const isOnlySpecialist = isSpecialist() && !isAdmin() && !canAccessFinance() && !isProjectManager() && !shouldFilterByAssignment();

  const { data: clients, isLoading, error } = useQuery({
    queryKey: ['clients', isOnlySpecialist, specialistId, needsFiltering, assignedClientIds],
    queryFn: async () => {
      // Specialist filtering: get clients from their requests
      if (isOnlySpecialist && specialistId) {
        const { data: requests, error: reqError } = await supabase
          .from('financial_requests')
          .select('client_id')
          .eq('specialist_id', specialistId);
        
        if (reqError) throw reqError;
        
        const clientIds = [...new Set(requests?.map(r => r.client_id) || [])];
        
        if (clientIds.length === 0) return [];
        
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .in('id', clientIds)
          .eq('status', 'active')
          .order('name');

        if (error) throw error;
        return data;
      }
      
      // AM/PM filtering: show only assigned clients
      if (needsFiltering && assignedClientIds.length > 0) {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .in('id', assignedClientIds)
          .eq('status', 'active')
          .order('name');

        if (error) throw error;
        return data;
      }
      
      // AM/PM with no assignments yet
      if (needsFiltering && assignedClientIds.length === 0) {
        return [];
      }
      
      // Default: show all clients (admin, finanzas)
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !rolesLoading && (!isOnlySpecialist || !specialistLoading) && (!needsFiltering || !assignedLoading),
  });

  const filteredClients = clients?.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNewClient = () => {
    setSelectedClient(null);
    setModalOpen(true);
  };

  const handleEditClient = (e: React.MouseEvent, client: any) => {
    e.stopPropagation();
    setSelectedClient(client);
    setModalOpen(true);
  };

  const handleClientClick = (clientId: string) => {
    navigate(`/clientes/${clientId}`);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  };

  if (error) {
    return (
      <AppLayout title="Clientes" description="Gestión de clientes">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-destructive">Error al cargar clientes: {error.message}</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Clientes" description="Gestión de clientes">
      <div className="space-y-6">
        {/* Barra de búsqueda y botón nuevo */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {!rolesLoading && canManage && (
            <Button onClick={handleNewClient}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Cliente
            </Button>
          )}
        </div>

        {/* Grid de clientes */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredClients && filteredClients.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <Card 
                key={client.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleClientClick(client.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{client.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {client.code || 'Sin código'}
                      </p>
                    </div>
                    <Badge
                      variant={client.status === 'active' ? 'default' : 'secondary'}
                      className={
                        client.status === 'active'
                          ? 'bg-green-500 hover:bg-green-600'
                          : ''
                      }
                    >
                      {client.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {client.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {(client.city || client.country) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span>
                        {[client.city, client.country].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  <div className="pt-3 flex gap-2">
                    {client.drive_folder_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(client.drive_folder_url, '_blank');
                        }}
                      >
                        <img src={GoogleDriveIcon} alt="Drive" className="h-4 w-4 mr-2" />
                        Customer DRIVE
                      </Button>
                    )}
                    {!rolesLoading && canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleEditClient(e, client)}
                        className="flex-1"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-muted-foreground text-lg mb-2">
                {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Crea tu primer cliente para comenzar'}
              </p>
              {!rolesLoading && canManage && !searchTerm && (
                <Button onClick={handleNewClient}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Cliente
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <ClientFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialData={selectedClient}
        onSuccess={handleSuccess}
      />
    </AppLayout>
  );
};

export default Clientes;
