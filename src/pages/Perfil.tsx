import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const profileSchema = z.object({
  full_name: z.string()
    .trim()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  avatar_url: z.string()
    .url('Debe ser una URL válida')
    .max(500, 'La URL no puede exceder 500 caracteres')
    .optional()
    .or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Perfil() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Usuario no autenticado');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: userRoles } = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) throw error;
      return data?.map(r => r.role) || [];
    },
    enabled: !!user?.id,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile?.full_name || '',
      avatar_url: profile?.avatar_url || '',
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!user?.id) throw new Error('Usuario no autenticado');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: values.full_name,
          avatar_url: values.avatar_url || null,
        })
        .eq('id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast({
        title: 'Perfil actualizado',
        description: 'Tu información ha sido actualizada correctamente.',
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el perfil',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    updateProfileMutation.mutate(values);
  };

  const handleCancel = () => {
    form.reset();
    setIsEditing(false);
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    finanzas: 'Finanzas',
    project_manager: 'Project Manager',
    especialista: 'Especialista',
    account_manager: 'Account Manager',
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Mi Perfil</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona tu información personal y configuración de cuenta
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile?.avatar_url || ''} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {profile?.full_name ? getInitials(profile.full_name) : <User className="h-6 w-6" />}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle>{profile?.full_name || 'Sin nombre'}</CardTitle>
                  <CardDescription>{profile?.email}</CardDescription>
                </div>
              </div>
              {!isEditing && (
                <Button onClick={() => setIsEditing(true)}>
                  Editar Perfil
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isEditing ? (
              <>
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="text-foreground font-medium">{profile?.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Nombre completo</Label>
                    <p className="text-foreground font-medium">{profile?.full_name || 'No especificado'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Avatar URL</Label>
                    <p className="text-foreground font-medium break-all">
                      {profile?.avatar_url || 'No especificado'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Roles</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {userRoles && userRoles.length > 0 ? (
                        userRoles.map((role) => (
                          <span
                            key={role}
                            className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                          >
                            {roleLabels[role] || role}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">Sin roles asignados</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Cuenta creada</Label>
                    <p className="text-foreground font-medium">
                      {new Date(profile?.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre completo</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Tu nombre completo"
                            {...field}
                            maxLength={100}
                          />
                        </FormControl>
                        <FormDescription>
                          Este es el nombre que se mostrará en el sistema
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="avatar_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL del Avatar</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://ejemplo.com/avatar.jpg"
                            {...field}
                            maxLength={500}
                          />
                        </FormControl>
                        <FormDescription>
                          URL pública de tu imagen de perfil (opcional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="submit"
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Guardar cambios
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={updateProfileMutation.isPending}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
