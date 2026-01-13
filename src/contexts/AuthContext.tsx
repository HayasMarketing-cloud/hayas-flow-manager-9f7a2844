import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

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

    // Helper function to validate user access
    const validateUserAccess = async (session: Session | null): Promise<boolean> => {
      if (!session?.user) return true; // No session, no validation needed
      
      const email = session.user.email;
      
      // Validate @hayas.es domain
      if (!email?.endsWith('@hayas.es')) {
        await supabase.auth.signOut();
        if (isMounted) {
          toast({
            title: "Acceso denegado",
            description: "Solo usuarios con email @hayas.es pueden acceder",
            variant: "destructive",
          });
        }
        return false;
      }

      // Verify user has a profile (was invited)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        if (isMounted) {
          toast({
            title: "Acceso denegado",
            description: "No tienes una invitación válida. Contacta con un administrador.",
            variant: "destructive",
          });
        }
        return false;
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard-mensual`,
          queryParams: {
            hd: 'hayas.es', // Restringe selector de cuentas a dominio hayas.es
          },
        },
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
