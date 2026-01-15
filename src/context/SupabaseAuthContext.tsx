/**
 * SupabaseAuthContext
 *
 * Manages Supabase authentication state.
 * Provides login, logout, session management, and MFA support.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError, Factor, AuthMFAEnrollResponse } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { setAuthToken } from '../api/client';

// Storage key for current user email (used by events.ts for aktor field)
export const USER_EMAIL_STORAGE_KEY = 'unified-timeline-user-email';

// MFA types
export interface MFAEnrollResult {
  factorId: string;
  qrCode: string;
  secret: string;
}

export interface MFAChallengeResult {
  challengeId: string;
  factorId: string;
}

interface SupabaseAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; mfaRequired?: boolean }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
  // MFA functions
  mfaEnabled: boolean;
  mfaFactors: Factor[];
  enrollMFA: () => Promise<{ data: MFAEnrollResult | null; error: AuthError | null }>;
  verifyMFAEnrollment: (factorId: string, code: string) => Promise<{ error: AuthError | null }>;
  challengeMFA: (factorId: string) => Promise<{ data: MFAChallengeResult | null; error: AuthError | null }>;
  verifyMFA: (factorId: string, challengeId: string, code: string) => Promise<{ error: AuthError | null }>;
  unenrollMFA: (factorId: string) => Promise<{ error: AuthError | null }>;
  getAuthenticatorAssuranceLevel: () => Promise<{ currentLevel: string | null; nextLevel: string | null }>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

interface SupabaseAuthProviderProps {
  children: ReactNode;
}

export function SupabaseAuthProvider({ children }: SupabaseAuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaFactors, setMfaFactors] = useState<Factor[]>([]);
  const isConfigured = isSupabaseConfigured();

  // Check if user has verified MFA factors
  const mfaEnabled = mfaFactors.some((f) => f.status === 'verified');

  // Fetch MFA factors for user
  const fetchMfaFactors = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!error && data) {
        setMfaFactors(data.totp || []);
      }
    } catch {
      // MFA not available or not configured
      setMfaFactors([]);
    }
  };

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
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
      // Fetch MFA factors if user is logged in
      if (session?.user) {
        await fetchMfaFactors();
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
      // Update MFA factors
      if (session?.user) {
        await fetchMfaFactors();
      } else {
        setMfaFactors([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [isConfigured]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    // Check if MFA is required (user has verified factors but AAL is not aal2)
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData && aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
      // User has MFA enabled but hasn't verified yet in this session
      return { error: null, mfaRequired: true };
    }

    return { error: null, mfaRequired: false };
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
    setMfaFactors([]);
  };

  // MFA: Enroll a new TOTP factor (returns QR code)
  const enrollMFA = async (): Promise<{ data: MFAEnrollResult | null; error: AuthError | null }> => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator App',
    });

    if (error || !data) {
      return { data: null, error };
    }

    return {
      data: {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      },
      error: null,
    };
  };

  // MFA: Verify enrollment with TOTP code (activates the factor)
  const verifyMFAEnrollment = async (factorId: string, code: string) => {
    // First create a challenge
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError || !challengeData) {
      return { error: challengeError };
    }

    // Then verify with the code
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (!error) {
      // Refresh factors list
      await fetchMfaFactors();
    }

    return { error };
  };

  // MFA: Create a challenge for verification (used during login)
  const challengeMFA = async (factorId: string): Promise<{ data: MFAChallengeResult | null; error: AuthError | null }> => {
    const { data, error } = await supabase.auth.mfa.challenge({ factorId });

    if (error || !data) {
      return { data: null, error };
    }

    return {
      data: {
        challengeId: data.id,
        factorId,
      },
      error: null,
    };
  };

  // MFA: Verify a challenge with TOTP code (completes login)
  const verifyMFA = async (factorId: string, challengeId: string, code: string) => {
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });

    return { error };
  };

  // MFA: Remove a factor (disable 2FA)
  const unenrollMFA = async (factorId: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });

    if (!error) {
      await fetchMfaFactors();
    }

    return { error };
  };

  // MFA: Get current authentication assurance level
  const getAuthenticatorAssuranceLevel = async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error || !data) {
      return { currentLevel: null, nextLevel: null };
    }

    return {
      currentLevel: data.currentLevel,
      nextLevel: data.nextLevel,
    };
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
        // MFA
        mfaEnabled,
        mfaFactors,
        enrollMFA,
        verifyMFAEnrollment,
        challengeMFA,
        verifyMFA,
        unenrollMFA,
        getAuthenticatorAssuranceLevel,
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
