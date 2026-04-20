import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    // Helper function to validate user access and create profile if invited
    const validateUserAccess = async (session: Session | null): Promise<boolean> => {
      if (!session?.user) return true; // No session, no validation needed
      
      const email = session.user.email;

      // Check if user has a profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .single();

      // If no profile, check for invitation and create profile
      if (!profile) {
        const { data: invitation } = await supabase
          .from('user_invitations')
          .select('id, roles, status, expires_at')
          .eq('email', email)
          .single();

        const isExpired = !invitation || 
          invitation.status === 'expired' || 
          (invitation.expires_at && new Date(invitation.expires_at) < new Date());

        if (isExpired) {
          await supabase.auth.signOut();
          if (isMounted) {
            toast({
              title: "Acceso denegado",
              description: invitation?.expires_at && new Date(invitation.expires_at) < new Date()
                ? "Tu invitación ha expirado. Contacta con un administrador para recibir una nueva."
                : "No tienes una invitación válida. Contacta con un administrador.",
              variant: "destructive",
            });
          }
          return false;
        }

        // Create profile for invited user
        const { error: profileCreateError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            email: email,
            full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split('@')[0],
            avatar_url: session.user.user_metadata?.avatar_url || null
          });

        if (profileCreateError) {
          console.error('[Auth] Error creating profile:', profileCreateError);
          await supabase.auth.signOut();
          if (isMounted) {
            toast({
              title: "Error",
              description: "Error al crear tu perfil. Contacta con un administrador.",
              variant: "destructive",
            });
          }
          return false;
        }

        // Assign roles from invitation
        if (invitation.roles && invitation.roles.length > 0) {
          const roleInserts = invitation.roles.map((role: AppRole) => ({
            user_id: session.user.id,
            role: role
          }));
          
          const { error: rolesError } = await supabase
            .from('user_roles')
            .insert(roleInserts);
          
          if (rolesError) {
            console.error('[Auth] Error assigning roles:', rolesError);
          }
        }

        // Update invitation status
        await supabase
          .from('user_invitations')
          .update({ 
            status: 'accepted', 
            accepted_at: new Date().toISOString() 
          })
          .eq('id', invitation.id);

        if (isMounted) {
          toast({
            title: "¡Bienvenido!",
            description: "Tu cuenta ha sido activada correctamente.",
          });
        }
      }

      return true;
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Event:', event, 'Session:', session?.user?.email);
        
        if (event === 'SIGNED_IN' && session?.user) {
          // Use setTimeout to defer Supabase calls and avoid blocking callback
          setTimeout(async () => {
            const isValid = await validateUserAccess(session);
            if (isMounted) {
              if (isValid) {
                setSession(session);
                setUser(session.user);
              } else {
                setSession(null);
                setUser(null);
              }
              setLoading(false);
            }
          }, 0);
          return; // Don't set loading false yet, wait for validation
        }
        
        if (event === 'SIGNED_OUT') {
          if (isMounted) {
            setSession(null);
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (event === 'INITIAL_SESSION') {
          // For initial session, validate and set state
          if (session?.user) {
            const isValid = await validateUserAccess(session);
            if (isMounted) {
              if (isValid) {
                setSession(session);
                setUser(session.user);
              } else {
                setSession(null);
                setUser(null);
              }
              setLoading(false);
            }
          } else {
            if (isMounted) {
              setSession(null);
              setUser(null);
              setLoading(false);
            }
          }
          return;
        }

        // For other events (TOKEN_REFRESHED, etc.), just update state
        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      }
    );

    // Trigger initial session check - the listener will handle the state
    supabase.auth.getSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Inicio de sesión exitoso",
        description: "Bienvenido de vuelta",
      });

      navigate('/dashboard-mensual');
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Error al iniciar sesión",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Registro exitoso",
        description: "Tu cuenta ha sido creada",
      });

      navigate('/dashboard-mensual');
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Error al registrarse",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const isCustomDomain = !window.location.hostname.endsWith('.lovable.app')
        && window.location.hostname !== 'localhost'
        && window.location.hostname !== '127.0.0.1';

      if (isCustomDomain) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
            queryParams: { hd: 'hayas.es', prompt: 'select_account' },
            skipBrowserRedirect: true,
          },
        });

        if (error) throw error;
        if (!data?.url) throw new Error('No se pudo iniciar el acceso con Google');

        window.location.assign(data.url);
        return { error: null };
      }

      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { hd: 'hayas.es', prompt: 'select_account' },
      });

      if (error) throw error;

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Error al iniciar sesión con Google",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Sesión cerrada",
        description: "Hasta pronto",
      });
      navigate('/auth');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, signIn, signUp, signInWithGoogle, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
