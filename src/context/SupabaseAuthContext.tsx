/**
 * SupabaseAuthContext
 *
 * Manages Supabase authentication state.
 * Provides login, logout, and session management.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { setAuthToken } from '../api/client';

// Storage key for current user email (used by events.ts for aktor field)
export const USER_EMAIL_STORAGE_KEY = 'unified-timeline-user-email';

interface SupabaseAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

interface SupabaseAuthProviderProps {
  children: ReactNode;
}

export function SupabaseAuthProvider({ children }: SupabaseAuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Set token for API client
      if (session?.access_token) {
        setAuthToken(session.access_token);
      }
      // Store user email for use by non-React code (events.ts)
      if (session?.user?.email) {
        localStorage.setItem(USER_EMAIL_STORAGE_KEY, session.user.email);
      } else {
        localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Update token for API client
      setAuthToken(session?.access_token ?? null);
      // Update stored user email
      if (session?.user?.email) {
        localStorage.setItem(USER_EMAIL_STORAGE_KEY, session.user.email);
      } else {
        localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, [isConfigured]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthToken(null);
    localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
  };

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        isConfigured,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  }
  return context;
}
