import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService } from '@/lib/encryption';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Récupération initiale de la session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth initialization error:', error);
          // En cas d'erreur critique (cookie invalide), on nettoie pour éviter le crash
          if (mounted) {
             setUser(null);
             setSession(null);
          }
        } else {
          if (mounted) {
            setSession(session);
            setUser(session?.user ?? null);
          }
        }
      } catch (error) {
        console.error('Unexpected auth error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Écouteur de changements (Connexion, Déconnexion, Refresh Token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`Auth event: ${event}`);
      
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }

      // Gestion spécifique des événements
      if (event === 'SIGNED_OUT') {
        // Nettoyage forcé des données locales si nécessaire
        setUser(null);
        setSession(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // On essaie de déconnecter côté serveur
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      // Si la session est déjà manquante, ce n'est pas grave, on veut juste nettoyer le local
      if (error.message?.includes('session missing') || error.name === 'AuthSessionMissingError') {
        console.warn('Session déjà expirée ou manquante lors de la déconnexion.');
      } else {
        console.error('Erreur lors de la déconnexion:', error);
      }
    } finally {
      // DANS TOUS LES CAS : on nettoie l'état local
      encryptionService.logout(); // Clear DEK from memory + sessionStorage
      setUser(null);
      setSession(null);
      
      // On force le nettoyage manuel des cookies pour être sûr (cross-subdomain)
      // Note : Le client Supabase le fait aussi, mais une double sécurité ne nuit pas ici
      const isProd = window.location.hostname.endsWith('sivara.ca');
      if (isProd) {
         document.cookie = 'sivara-auth-token=; path=/; domain=.sivara.ca; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};