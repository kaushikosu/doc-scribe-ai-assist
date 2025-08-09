import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

// Normalized user shape for the app regardless of auth provider
export type AppUser = {
  id: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ currentUser: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth state changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        setCurrentUser({
          id: u.id,
          email: u.email,
          displayName: (u.user_metadata?.full_name as string | undefined) || (u.user_metadata?.name as string | undefined) || u.email?.split('@')[0] || null,
          photoURL: (u.user_metadata?.picture as string | undefined) || null,
        });
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    // THEN fetch current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        setCurrentUser({
          id: u.id,
          email: u.email,
          displayName: (u.user_metadata?.full_name as string | undefined) || (u.user_metadata?.name as string | undefined) || u.email?.split('@')[0] || null,
          photoURL: (u.user_metadata?.picture as string | undefined) || null,
        });
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
