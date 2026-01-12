import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
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
import { useState } from 'react';

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

interface Invitation {
  id: string;
  email: string;
  roles: UserRole[];
  status: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

export function InvitationsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [invitationToDelete, setInvitationToDelete] = useState<string | null>(null);

  const { data: invitations, isLoading } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Invitation[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_invitations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
      toast({
        title: 'Invitación eliminada',
        description: 'La invitación ha sido eliminada correctamente',
      });
      setInvitationToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (invitation: Invitation) => {
      if (!user) throw new Error('No autenticado');

      // Get inviter's profile
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();

      const invitedByName = inviterProfile?.full_name || inviterProfile?.email || 'Un administrador';
      const senderEmail = user.email || inviterProfile?.email;

      if (!senderEmail) {
        throw new Error('No se pudo obtener el email del remitente');
      }

      const response = await supabase.functions.invoke('send-user-invitation', {
        body: {
          recipientEmail: invitation.email,
          invitedByName,
          roles: invitation.roles,
          senderEmail,
          appUrl: window.location.origin,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Error al reenviar invitación');
      }

      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Invitación reenviada',
        description: 'El email de invitación ha sido reenviado',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getStatusInfo = (invitation: Invitation) => {
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);

    if (invitation.status === 'accepted') {
      return {
        label: 'Aceptada',
        icon: CheckCircle,
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      };
    }

    if (expiresAt < now) {
      return {
        label: 'Expirada',
        icon: XCircle,
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      };
    }

    return {
      label: 'Pendiente',
      icon: Clock,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!invitations || invitations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No hay invitaciones registradas
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {invitations.map((invitation) => {
          const statusInfo = getStatusInfo(invitation);
          const StatusIcon = statusInfo.icon;
          const isExpired = new Date(invitation.expires_at) < new Date();
          const isPending = invitation.status === 'pending' && !isExpired;

          return (
            <Card key={invitation.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{invitation.email}</span>
                      <Badge className={statusInfo.className}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap gap-1">
                      {invitation.roles.map((role) => (
                        <Badge key={role} className={roleColors[role]} variant="secondary">
                          {roleLabels[role]}
                        </Badge>
                      ))}
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        Creada {formatDistanceToNow(new Date(invitation.created_at), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </p>
                      {invitation.status === 'accepted' && invitation.accepted_at && (
                        <p>
                          Aceptada {formatDistanceToNow(new Date(invitation.accepted_at), { 
                            addSuffix: true, 
                            locale: es 
                          })}
                        </p>
                      )}
                      {isPending && (
                        <p>
                          Expira {formatDistanceToNow(new Date(invitation.expires_at), { 
                            addSuffix: true, 
                            locale: es 
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isPending && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendMutation.mutate(invitation)}
                        disabled={resendMutation.isPending}
                      >
                        {resendMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Reenviar
                          </>
                        )}
                      </Button>
                    )}
                    {invitation.status !== 'accepted' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setInvitationToDelete(invitation.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!invitationToDelete} onOpenChange={() => setInvitationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar invitación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la invitación y el usuario no podrá acceder al sistema
              con este enlace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => invitationToDelete && deleteMutation.mutate(invitationToDelete)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
