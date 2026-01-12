import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { RoleBasedRoute } from '@/components/RoleBasedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, UserPlus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { InviteUserModal } from '@/components/users/InviteUserModal';
import { InvitationsList } from '@/components/users/InvitationsList';

type UserRole = 'admin' | 'moderator' | 'user' | 'finanzas' | 'project_manager' | 'especialista' | 'account_manager' | 'seller';

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  moderator: 'Moderador',
  user: 'Usuario',
  finanzas: 'Finanzas',
  project_manager: 'Project Manager',
  especialista: 'Especialista',
  account_manager: 'Account Manager',
  seller: 'Vendedor',
};

const roleColors: Record<UserRole, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  moderator: 'bg-primary text-primary-foreground',
  user: 'bg-secondary text-secondary-foreground',
  finanzas: 'bg-blue-500 text-white',
  project_manager: 'bg-purple-500 text-white',
  especialista: 'bg-green-500 text-white',
  account_manager: 'bg-orange-500 text-white',
  seller: 'bg-yellow-500 text-white',
};

function UsuariosContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');
  const [roleToDelete, setRoleToDelete] = useState<{ userId: string; role: UserRole } | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      return profiles?.map(profile => ({
        ...profile,
        roles: roles?.filter(r => r.user_id === profile.id).map(r => r.role as UserRole) || [],
      })) || [];
    },
  });

  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Rol asignado',
        description: 'El rol se ha asignado correctamente al usuario.',
      });
      setSelectedUserId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo asignar el rol',
        variant: 'destructive',
      });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Rol eliminado',
        description: 'El rol se ha eliminado correctamente.',
      });
      setRoleToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el rol',
        variant: 'destructive',
      });
    },
  });

  const handleAddRole = (userId: string) => {
    addRoleMutation.mutate({ userId, role: selectedRole });
  };

  const handleDeleteRole = (userId: string, role: UserRole) => {
    setRoleToDelete({ userId, role });
  };

  const confirmDeleteRole = () => {
    if (roleToDelete) {
      deleteRoleMutation.mutate(roleToDelete);
    }
  };

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
            <h1 className="text-3xl font-bold text-foreground">Gestión de Usuarios</h1>
            <p className="text-muted-foreground mt-2">
              Administra los roles y permisos de los usuarios del sistema
            </p>
          </div>
          <Button onClick={() => setIsInviteModalOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invitar Usuario
          </Button>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users">Usuarios Activos</TabsTrigger>
            <TabsTrigger value="invitations">Invitaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="grid gap-4">
              {users?.map((user) => (
                <Card key={user.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{user.full_name || 'Sin nombre'}</CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Creado: {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Roles actuales:</p>
                        <div className="flex flex-wrap gap-2">
                          {user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Badge
                                key={role}
                                className={`${roleColors[role]} flex items-center gap-1`}
                              >
                                {roleLabels[role]}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 p-0 hover:bg-transparent"
                                  onClick={() => handleDeleteRole(user.id, role)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">Sin roles asignados</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium mb-2">Agregar rol:</p>
                          <Select
                            value={selectedUserId === user.id ? selectedRole : ''}
                            onValueChange={(value) => {
                              setSelectedUserId(user.id);
                              setSelectedRole(value as UserRole);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar rol" />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(roleLabels) as UserRole[])
                                .filter(role => !user.roles.includes(role))
                                .map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {roleLabels[role]}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={() => handleAddRole(user.id)}
                          disabled={selectedUserId !== user.id || addRoleMutation.isPending}
                        >
                          {addRoleMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Agregar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {users?.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No hay usuarios registrados en el sistema
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="invitations">
            <InvitationsList />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar rol?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar el rol{' '}
              <strong>{roleToDelete && roleLabels[roleToDelete.role]}</strong> de este usuario?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRole}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InviteUserModal 
        open={isInviteModalOpen} 
        onOpenChange={setIsInviteModalOpen} 
      />
    </AppLayout>
  );
}

export default function Usuarios() {
  return (
    <RoleBasedRoute allowedRoles={['admin']}>
      <UsuariosContent />
    </RoleBasedRoute>
  );
}
