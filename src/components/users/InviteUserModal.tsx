import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, UserPlus } from 'lucide-react';

type UserRole = 'admin' | 'finanzas' | 'project_manager' | 'especialista' | 'account_manager';

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  finanzas: 'Finanzas',
  project_manager: 'Project Manager',
  account_manager: 'Account Manager',
  especialista: 'Especialista',
};

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserModal({ open, onOpenChange }: InviteUserModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [email, setEmail] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No autenticado');

      // Validate email format
      const emailLower = email.toLowerCase().trim();
      if (!emailLower.endsWith('@hayas.es')) {
        throw new Error('El email debe ser @hayas.es');
      }

      if (selectedRoles.length === 0) {
        throw new Error('Debes seleccionar al menos un rol');
      }

      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', emailLower)
        .maybeSingle();

      if (existingProfile) {
        throw new Error('Este usuario ya existe en el sistema');
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Check latest invitation for this email (if any)
      const { data: existingInvitation, error: existingInvitationError } = await supabase
        .from('user_invitations')
        .select('id, status')
        .eq('email', emailLower)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingInvitationError) throw existingInvitationError;

      // If there is a pending invitation, refresh it (extend expiry + update roles) and resend
      if (existingInvitation) {
        if (existingInvitation.status === 'accepted') {
          throw new Error('Este usuario ya ha sido invitado y aceptó la invitación');
        }

        const { error: updateError } = await supabase
          .from('user_invitations')
          .update({
            roles: selectedRoles,
            invited_by: user.id,
            status: 'pending',
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
            accepted_at: null,
          })
          .eq('id', existingInvitation.id);

        if (updateError) throw updateError;

        // Send invitation email
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
            recipientEmail: emailLower,
            invitedByName,
            roles: selectedRoles,
            senderEmail,
            appUrl: window.location.origin,
          },
        });

        if (response.error) {
          console.error('Error sending invitation email:', response.error);
          return { emailSent: false, resent: true };
        }

        return { emailSent: true, resent: true };
      }

      // Create new invitation
      const { error: insertError } = await supabase
        .from('user_invitations')
        .insert({
          email: emailLower,
          invited_by: user.id,
          roles: selectedRoles,
          expires_at: expiresAt,
        });

      if (insertError) throw insertError;

      // Get inviter's profile for the email
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

      // Send invitation email
      const response = await supabase.functions.invoke('send-user-invitation', {
        body: {
          recipientEmail: emailLower,
          invitedByName,
          roles: selectedRoles,
          senderEmail,
          appUrl: window.location.origin,
        },
      });

      if (response.error) {
        console.error('Error sending invitation email:', response.error);
        // Don't throw - invitation was created, just email failed
        return { emailSent: false, resent: false };
      }

      return { emailSent: true, resent: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
      toast({
        title: result?.resent ? 'Invitación reenviada' : 'Invitación creada',
        description: result?.emailSent
          ? (result?.resent ? 'La invitación se ha reenviado por email' : 'La invitación ha sido enviada por email')
          : (result?.resent ? 'La invitación se actualizó pero no se pudo reenviar el email' : 'La invitación fue creada pero no se pudo enviar el email'),
      });
      onOpenChange(false);
      setEmail('');
      setSelectedRoles([]);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleRole = (role: UserRole) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invitar Usuario
          </DialogTitle>
          <DialogDescription>
            Invita a un nuevo usuario al sistema. Debe tener una cuenta @hayas.es.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate(); }} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="usuario@hayas.es"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Solo se permiten emails @hayas.es
            </p>
          </div>

          <div className="space-y-3">
            <Label>Roles a asignar</Label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(roleLabels) as UserRole[]).map((role) => (
                <div key={role} className="flex items-center space-x-2">
                  <Checkbox
                    id={role}
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  <Label 
                    htmlFor={role} 
                    className="text-sm font-normal cursor-pointer"
                  >
                    {roleLabels[role]}
                  </Label>
                </div>
              ))}
            </div>
            {selectedRoles.length === 0 && (
              <p className="text-xs text-destructive">
                Debes seleccionar al menos un rol
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={inviteMutation.isPending || selectedRoles.length === 0}
            >
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar Invitación
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
