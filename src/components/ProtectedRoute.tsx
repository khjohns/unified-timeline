/**
 * ProtectedRoute Component
 *
 * Wrapper that requires Supabase authentication AND MFA.
 * Shows login form if user is not authenticated.
 * Shows MFA setup if user hasn't enabled 2FA.
 */

import { ReactNode, useEffect, useState } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { LoginForm } from './LoginForm';
import { MFARequired } from './MFARequired';
import { ReloadIcon } from '@radix-ui/react-icons';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Skip MFA requirement (e.g., for settings page where user sets up MFA) */
  skipMfaCheck?: boolean;
}

export function ProtectedRoute({ children, skipMfaCheck = false }: ProtectedRouteProps) {
  const { user, loading, isConfigured, mfaEnabled, getAuthenticatorAssuranceLevel } = useSupabaseAuth();
  const [aalChecked, setAalChecked] = useState(false);
  const [needsMfaVerification, setNeedsMfaVerification] = useState(false);

  // Check AAL level after user is loaded
  useEffect(() => {
    if (!isConfigured || loading || !user) {
      setAalChecked(true);
      return;
    }

    const checkAAL = async () => {
      const { currentLevel, nextLevel } = await getAuthenticatorAssuranceLevel();
      // User has MFA but hasn't verified in this session
      if (currentLevel === 'aal1' && nextLevel === 'aal2') {
        setNeedsMfaVerification(true);
      } else {
        setNeedsMfaVerification(false);
      }
      setAalChecked(true);
    };

    checkAAL();
  }, [isConfigured, loading, user, mfaEnabled, getAuthenticatorAssuranceLevel]);

  // If Supabase is not configured, allow access (dev mode)
  if (!isConfigured) {
    return <>{children}</>;
  }

  // Loading state
  if (loading || !aalChecked) {
    return (
      <div className="min-h-screen bg-pkt-bg-default flex items-center justify-center">
        <div className="text-center">
          <ReloadIcon className="w-12 h-12 mx-auto mb-4 text-pkt-border-default animate-spin" />
          <p className="text-pkt-text-body-subtle">Laster...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!user) {
    return <LoginForm />;
  }

  // User needs to verify MFA (has it enabled but not verified in this session)
  if (needsMfaVerification) {
    return <LoginForm />;
  }

  // MFA not enabled - require setup (unless skipped for settings page)
  if (!skipMfaCheck && !mfaEnabled) {
    return <MFARequired />;
  }

  // Authenticated with MFA - render children
  return <>{children}</>;
}
