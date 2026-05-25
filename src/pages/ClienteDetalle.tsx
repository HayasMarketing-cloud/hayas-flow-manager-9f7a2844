import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Edit,
  Star,
  Trash2,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClientFormModal } from '@/components/modals/ClientFormModal';
import { ContactFormModal } from '@/components/modals/ContactFormModal';
import { ClientContractsTab } from '@/components/clients/ClientContractsTab';
import { ClientBudgetsTab } from '@/components/clients/ClientBudgetsTab';
import { ClientProjectsTab } from '@/components/clients/ClientProjectsTab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import GoogleDriveIcon from '@/assets/icons8-google-drive.svg';


const CONTACTS_PER_PAGE = 10;

const ClienteDetalle = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canManageClients, canEditAssignedClients, loading: rolesLoading } = useUserRole();
  const canManage = canManageClients();
  const canEdit = canManage || canEditAssignedClients();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [currentPage, setCurrentPage] = useState(1);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);

  // Fetch client data
  const {
    data: client,
    isLoading: clientLoading,
    error: clientError,
  } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Cliente no encontrado');
      return data;
    },
    enabled: !!id,
  });

  // Fetch contacts
  const {
    data: contacts,
    isLoading: contactsLoading,
    error: contactsError,
  } = useQuery({
    queryKey: ['client-contacts', id, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('client_contacts')
        .select('*')
        .eq('client_id', id)
        .order('is_primary', { ascending: false })
        .order('name');

      if (statusFilter === 'active') {
        query = query.eq('active', true);
      } else if (statusFilter === 'inactive') {
        query = query.eq('active', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      // Desvincular solicitudes financieras que referencian este contacto
      const { error: unlinkError } = await supabase
        .from('financial_requests')
        .update({ client_contact_id: null })
        .eq('client_contact_id', contactId);
      if (unlinkError) throw unlinkError;

      // Desvincular presupuestos que referencian este contacto
      const { error: unlinkBudgetError } = await supabase
        .from('budgets')
        .update({ client_contact_id: null })
        .eq('client_contact_id', contactId);
      if (unlinkBudgetError) throw unlinkBudgetError;

      const { error } = await supabase
        .from('client_contacts')
        .delete()
        .eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts', id] });
      toast.success('Contacto eliminado');
      setDeleteContactId(null);
    },
    onError: (error: any) => {
      toast.error('Error al eliminar contacto: ' + error.message);
    },
  });

  // Filter contacts by search term
  const filteredContacts = contacts?.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil((filteredContacts?.length || 0) / CONTACTS_PER_PAGE);
  const paginatedContacts = filteredContacts?.slice(
    (currentPage - 1) * CONTACTS_PER_PAGE,
    currentPage * CONTACTS_PER_PAGE
  );

  const handleNewContact = () => {
    setSelectedContact(null);
    setContactModalOpen(true);
  };

  const handleEditContact = (contact: any) => {
    setSelectedContact(contact);
    setContactModalOpen(true);
  };

  const handleContactSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['client-contacts', id] });
  };

  const handleClientSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['client', id] });
  };

  if (clientError) {
    return (
      <AppLayout title="Error" description="">
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <p className="text-destructive mb-4">
              {clientError.message || 'Error al cargar el cliente'}
            </p>
            <Button variant="outline" onClick={() => navigate('/clientes')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Clientes
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={client?.name || 'Cargando...'}
      description="Detalle del cliente"
    >
      <div className="space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/clientes')}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Clientes
        </Button>

        {/* Client header card */}
        {clientLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-4 w-1/3 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ) : client ? (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{client.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {client.code || 'Sin código'}
                      {client.tax_id && ` · NIF: ${client.tax_id}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                  {client.hub_client_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={client.hub_client_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        HUB Cliente
                      </a>
                    </Button>
                  )}
                  {client.drive_folder_url && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => window.open(client.drive_folder_url, '_blank')}
                    >
                      <img src={GoogleDriveIcon} alt="Drive" className="h-4 w-4 mr-2" />
                      Customer DRIVE
                    </Button>
                  )}
                  {!rolesLoading && canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setClientModalOpen(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {client.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {(client.address || client.city || client.country) && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {[client.address, client.city, client.country]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                )}
                {client.default_hourly_rate && client.default_hourly_rate > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="font-mono">
                      {client.default_hourly_rate.toFixed(2)} €/h
                    </Badge>
                    <span className="text-muted-foreground">Tarifa por defecto</span>
                  </div>
                )}
              </div>
              {client.notes && (
                <p className="text-sm text-muted-foreground mt-4 border-t pt-4">
                  {client.notes}
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Contacts section */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg">
                Contactos ({filteredContacts?.length || 0})
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar contactos..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10 w-full sm:w-64"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="inactive">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
                {!rolesLoading && canEdit && (
                  <Button onClick={handleNewContact}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Contacto
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {contactsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : contactsError ? (
              <p className="text-destructive text-center py-8">
                Error al cargar contactos
              </p>
            ) : paginatedContacts && paginatedContacts.length > 0 ? (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="hidden md:table-cell">Cargo</TableHead>
                        <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                        <TableHead className="hidden lg:table-cell">Ciudad</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedContacts.map((contact) => (
                        <TableRow
                          key={contact.id}
                          className={!contact.active ? 'opacity-60' : ''}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {contact.is_primary && (
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              )}
                              <span className="font-medium">{contact.name}</span>
                              {!contact.active && (
                                <Badge variant="secondary" className="text-xs">
                                  Inactivo
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <a
                              href={`mailto:${contact.email}`}
                              className="text-primary hover:underline"
                            >
                              {contact.email}
                            </a>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {contact.role || '-'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {contact.phone || '-'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {contact.city || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {!rolesLoading && canEdit && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditContact(contact)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                {canManage && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteContactId(contact.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {(currentPage - 1) * CONTACTS_PER_PAGE + 1}-
                      {Math.min(
                        currentPage * CONTACTS_PER_PAGE,
                        filteredContacts?.length || 0
                      )}{' '}
                      de {filteredContacts?.length} contactos
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground mb-2">
                  {searchTerm
                    ? 'No se encontraron contactos'
                    : 'No hay contactos registrados'}
                </p>
                {!rolesLoading && canEdit && !searchTerm && (
                  <Button onClick={handleNewContact} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Crear primer contacto
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Client edit modal */}
      <ClientFormModal
        open={clientModalOpen}
        onOpenChange={setClientModalOpen}
        initialData={client}
        onSuccess={handleClientSuccess}
      />

      {/* Contact form modal */}
      <ContactFormModal
        open={contactModalOpen}
        onOpenChange={setContactModalOpen}
        clientId={id!}
        initialData={selectedContact}
        onSuccess={handleContactSuccess}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteContactId}
        onOpenChange={(open) => !open && setDeleteContactId(null)}
        title="Eliminar contacto"
        description="¿Estás seguro de que deseas eliminar este contacto? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        onConfirm={() => deleteContactId && deleteContactMutation.mutate(deleteContactId)}
        variant="destructive"
      />
    </AppLayout>
  );
};

export default ClienteDetalle;
